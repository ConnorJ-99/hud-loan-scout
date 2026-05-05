import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OpsPageHeader } from "@/components/ops/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchStaffProfiles, staffName, staffNameByUserId } from "@/lib/ops/profiles";
import { COMP_PLANS, formatCurrency, type CompPlan } from "@/lib/ops/loan-helpers";
import { Download, Trash2 } from "lucide-react";
import { downloadCsv, toCsv } from "@/lib/ops/csv";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ops/admin/payroll")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/ops" });
  },
  component: PayrollPage,
});

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "semimonthly", label: "Semi-Monthly" },
  { value: "monthly", label: "Monthly" },
];

function periodsPerYear(freq: string | null | undefined) {
  switch (freq) {
    case "weekly": return 52;
    case "biweekly": return 26;
    case "semimonthly": return 24;
    default: return 12;
  }
}

function PayrollPage() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetch("/api/public/hooks/auto-payroll", { method: "POST" }).catch(() => undefined);
  }, []);

  const { data: profiles = [] } = useQuery({
    queryKey: ["ops-staff"],
    queryFn: () => fetchStaffProfiles("annual_salary, annual_draw, monthly_salary, monthly_draw, comp_plan, pay_frequency, pay_day"),
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["ops-payouts"],
    queryFn: async () => (await supabase.from("salary_payouts").select("*").order("pay_period", { ascending: false })).data ?? [],
  });

  const { data: fundedLoans = [] } = useQuery({
    queryKey: ["ops-funded-loan-comp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loans")
        .select("id, borrower_name, assigned_lo, stage, loan_amount, lo_comp_amount, actual_close_date")
        .eq("stage", "funded")
        .order("actual_close_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateProfile = useMutation({
    mutationFn: async ({ user_id, patch }: { user_id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("profiles").update(patch as never).eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops-staff"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePayout = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("salary_payouts").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops-payouts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removePayout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("salary_payouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops-payouts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const rollups = useMemo(() => {
    return profiles.map((profile) => {
      const userPayouts = payouts.filter((p) => p.user_id === profile.user_id);
      const userFunded = fundedLoans.filter((loan) => loan.assigned_lo === profile.user_id);
      const salaryPaid = userPayouts.reduce((sum, row) => sum + Number(row.salary_amount ?? 0) + Number(row.draw_amount ?? 0), 0);
      const commissionPaid = userFunded.reduce((sum, row) => sum + Number(row.lo_comp_amount ?? 0), 0);
      const fundedCount = userFunded.length;
      return {
        user_id: profile.user_id,
        name: staffName(profile),
        salaryPaid,
        commissionPaid,
        totalPay: salaryPaid + commissionPaid,
        fundedCount,
        avgComp: fundedCount ? commissionPaid / fundedCount : 0,
        volume: userFunded.reduce((sum, row) => sum + Number(row.loan_amount ?? 0), 0),
      };
    });
  }, [profiles, payouts, fundedLoans]);

  return (
    <div>
      <OpsPageHeader
        title="Payroll"
        subtitle="Annual salary, automatic pay periods, and funded-loan compensation in one place."
        actions={
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-panel"
            onClick={() => {
              const csv = toCsv(rollups.map((r) => ({
                staff: r.name,
                total_pay: r.totalPay.toFixed(2),
                salary_and_draw: r.salaryPaid.toFixed(2),
                loan_commission: r.commissionPaid.toFixed(2),
                loans_closed: r.fundedCount,
                average_comp_per_loan: r.avgComp.toFixed(2),
                funded_volume: r.volume.toFixed(2),
              })));
              downloadCsv(`payroll-summary-${today}.csv`, csv);
            }}
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">Staff compensation setup</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-panel/40 text-left">
                  <tr>
                    <th className="px-4 py-2">Staff</th>
                    <th className="px-4 py-2">Plan</th>
                    <th className="px-4 py-2">Commission %</th>
                    <th className="px-4 py-2">Annual salary</th>
                    <th className="px-4 py-2">Annual draw</th>
                    <th className="px-4 py-2">Frequency</th>
                    <th className="px-4 py-2">Pay day</th>
                    <th className="px-4 py-2">Per paycheck</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => {
                    const annualSalary = Number(p.annual_salary ?? Number(p.monthly_salary ?? 0) * 12);
                    const annualDraw = Number(p.annual_draw ?? Number(p.monthly_draw ?? 0) * 12);
                    const periods = periodsPerYear(p.pay_frequency);
                    const perCheck = (annualSalary + annualDraw) / periods;
                    return (
                      <tr key={p.user_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium">{staffName(p)}</td>
                        <td className="px-4 py-2">
                          <Select value={(p.comp_plan as CompPlan) ?? "commission_only"} onValueChange={(v) => updateProfile.mutate({ user_id: p.user_id, patch: { comp_plan: v } })}>
                            <SelectTrigger className="h-8 w-[190px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{COMP_PLANS.map((plan) => <SelectItem key={plan.value} value={plan.value}>{plan.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 w-24"
                            defaultValue={((Number(p.default_comp_pct ?? 0)) * 100).toFixed(2)}
                            onBlur={(e) => updateProfile.mutate({ user_id: p.user_id, patch: { default_comp_pct: (Number(e.target.value) || 0) / 100 } })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            className="h-8 w-32"
                            defaultValue={annualSalary}
                            onBlur={(e) => updateProfile.mutate({ user_id: p.user_id, patch: { annual_salary: Number(e.target.value) || 0, monthly_salary: (Number(e.target.value) || 0) / 12 } })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            className="h-8 w-32"
                            defaultValue={annualDraw}
                            onBlur={(e) => updateProfile.mutate({ user_id: p.user_id, patch: { annual_draw: Number(e.target.value) || 0, monthly_draw: (Number(e.target.value) || 0) / 12 } })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Select value={p.pay_frequency || "monthly"} onValueChange={(v) => updateProfile.mutate({ user_id: p.user_id, patch: { pay_frequency: v } })}>
                            <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min="1"
                            max="28"
                            className="h-8 w-20"
                            defaultValue={p.pay_day ?? ""}
                            onBlur={(e) => updateProfile.mutate({ user_id: p.user_id, patch: { pay_day: e.target.value ? Number(e.target.value) : null } })}
                          />
                        </td>
                        <td className="px-4 py-2 font-mono">{formatCurrency(perCheck)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">Total pay over time</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-panel/40 text-left">
                  <tr>
                    <th className="px-4 py-2">Staff</th>
                    <th className="px-4 py-2">Salary + draw paid</th>
                    <th className="px-4 py-2">Loan comp earned</th>
                    <th className="px-4 py-2">Total pay</th>
                    <th className="px-4 py-2">Loans closed</th>
                    <th className="px-4 py-2">Avg comp / loan</th>
                    <th className="px-4 py-2">Funded volume</th>
                  </tr>
                </thead>
                <tbody>
                  {rollups.map((row) => (
                    <tr key={row.user_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">{row.name}</td>
                      <td className="px-4 py-2 font-mono">{formatCurrency(row.salaryPaid)}</td>
                      <td className="px-4 py-2 font-mono">{formatCurrency(row.commissionPaid)}</td>
                      <td className="px-4 py-2 font-mono">{formatCurrency(row.totalPay)}</td>
                      <td className="px-4 py-2">{row.fundedCount}</td>
                      <td className="px-4 py-2 font-mono">{formatCurrency(row.avgComp)}</td>
                      <td className="px-4 py-2 font-mono">{formatCurrency(row.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">Automatic salary payout history</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-panel/40 text-left">
                  <tr>
                    <th className="px-4 py-2">Staff</th>
                    <th className="px-4 py-2">Pay period</th>
                    <th className="px-4 py-2">Salary</th>
                    <th className="px-4 py-2">Draw</th>
                    <th className="px-4 py-2">Paid on</th>
                    <th className="px-4 py-2">Notes</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">{staffNameByUserId(profiles, p.user_id)}</td>
                      <td className="px-4 py-2"><Input type="date" className="h-8 w-36" defaultValue={p.pay_period ?? ""} onBlur={(e) => updatePayout.mutate({ id: p.id, patch: { pay_period: e.target.value } })} /></td>
                      <td className="px-4 py-2"><Input type="number" className="h-8 w-28" defaultValue={Number(p.salary_amount ?? 0)} onBlur={(e) => updatePayout.mutate({ id: p.id, patch: { salary_amount: Number(e.target.value) || 0 } })} /></td>
                      <td className="px-4 py-2"><Input type="number" className="h-8 w-28" defaultValue={Number(p.draw_amount ?? 0)} onBlur={(e) => updatePayout.mutate({ id: p.id, patch: { draw_amount: Number(e.target.value) || 0 } })} /></td>
                      <td className="px-4 py-2"><Input type="date" className="h-8 w-36" defaultValue={p.paid_on ?? ""} onBlur={(e) => updatePayout.mutate({ id: p.id, patch: { paid_on: e.target.value || null } })} /></td>
                      <td className="px-4 py-2"><Input className="h-8 w-56" defaultValue={p.notes ?? ""} onBlur={(e) => updatePayout.mutate({ id: p.id, patch: { notes: e.target.value || null } })} /></td>
                      <td className="px-4 py-2 text-right"><button className="rounded p-2 hover:bg-panel" onClick={() => removePayout.mutate(p.id)}><Trash2 className="h-4 w-4 text-red-500" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-4 py-3 text-sm font-medium">Funded loan compensation history</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-panel/40 text-left">
                  <tr>
                    <th className="px-4 py-2">Borrower</th>
                    <th className="px-4 py-2">Loan officer</th>
                    <th className="px-4 py-2">Funded on</th>
                    <th className="px-4 py-2">Loan amount</th>
                    <th className="px-4 py-2">LO comp</th>
                  </tr>
                </thead>
                <tbody>
                  {fundedLoans.map((loan) => (
                    <tr key={loan.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">{loan.borrower_name}</td>
                      <td className="px-4 py-2">{staffNameByUserId(profiles, loan.assigned_lo)}</td>
                      <td className="px-4 py-2">{loan.actual_close_date ?? "—"}</td>
                      <td className="px-4 py-2 font-mono">{formatCurrency(Number(loan.loan_amount ?? 0))}</td>
                      <td className="px-4 py-2 font-mono">{formatCurrency(Number(loan.lo_comp_amount ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
