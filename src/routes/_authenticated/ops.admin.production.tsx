import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OpsPageHeader } from "@/components/ops/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchStaffProfiles, staffNameByUserId } from "@/lib/ops/profiles";
import { computeBreakdown, formatCurrency, type CompMode } from "@/lib/ops/loan-helpers";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/ops/csv";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/admin/production")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/ops" });
  },
  component: ProductionPage,
});

function ProductionPage() {
  const { data: loans = [] } = useQuery({
    queryKey: ["ops-prod-loans"],
    queryFn: async () => (await supabase.from("loans").select("*")).data ?? [],
  });
  const { data: fees = [] } = useQuery({
    queryKey: ["ops-prod-fees"],
    queryFn: async () => (await supabase.from("loan_fees").select("*")).data ?? [],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["ops-prod-expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*")).data ?? [],
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["ops-staff"], queryFn: () => fetchStaffProfiles() });

  const stats = useMemo(() => {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startYear = new Date(now.getFullYear(), 0, 1);

    const funded = loans.filter((l) => l.stage === "funded");
    const inRange = (date: string | null, from: Date) => date && new Date(date) >= from;

    const fundedMtd = funded.filter((l) => inRange(l.actual_close_date, startMonth));
    const fundedYtd = funded.filter((l) => inRange(l.actual_close_date, startYear));

    const sumLoan = (arr: typeof loans) => arr.reduce((a, l) => a + Number(l.loan_amount ?? 0), 0);

    const breakdownsFor = (arr: typeof loans) => arr.map((l) => {
      const lFees = fees.filter((f) => f.loan_id === l.id).map((f) => ({
        amount_mode: f.amount_mode, flat_amount: Number(f.flat_amount ?? 0),
        pct_of_gross: Number(f.pct_of_gross ?? 0), deduct_from: f.deduct_from,
      }));
      return { loan: l, b: computeBreakdown({
        loan_amount: Number(l.loan_amount ?? 0), comp_mode: l.comp_mode as CompMode,
        comp_points: Number(l.comp_points ?? 0), comp_flat_amount: Number(l.comp_flat_amount ?? 0),
        lo_split_pct: Number(l.lo_split_pct ?? 0), house_split_pct: Number(l.house_split_pct ?? 0),
      }, lFees) };
    });

    const mtd = breakdownsFor(fundedMtd);
    const ytd = breakdownsFor(fundedYtd);

    const grossMtd = mtd.reduce((a, x) => a + x.b.grossCommission, 0);
    const houseMtd = mtd.reduce((a, x) => a + x.b.houseNet, 0);
    const grossYtd = ytd.reduce((a, x) => a + x.b.grossCommission, 0);
    const houseYtd = ytd.reduce((a, x) => a + x.b.houseNet, 0);

    const expensesYtd = expenses.filter((e) => e.date_paid && new Date(e.date_paid) >= startYear)
      .reduce((a, e) => a + Number(e.amount ?? 0), 0);

    // Per-LO breakdown YTD
    const byLo = new Map<string, { loanCount: number; volume: number; gross: number; loNet: number }>();
    for (const x of ytd) {
      const key = x.loan.assigned_lo ?? "unassigned";
      const cur = byLo.get(key) ?? { loanCount: 0, volume: 0, gross: 0, loNet: 0 };
      cur.loanCount += 1;
      cur.volume += Number(x.loan.loan_amount ?? 0);
      cur.gross += x.b.grossCommission;
      cur.loNet += x.b.loNet;
      byLo.set(key, cur);
    }

    return {
      mtd: { count: fundedMtd.length, volume: sumLoan(fundedMtd), gross: grossMtd, house: houseMtd },
      ytd: { count: fundedYtd.length, volume: sumLoan(fundedYtd), gross: grossYtd, house: houseYtd },
      expensesYtd,
      profitYtd: houseYtd - expensesYtd,
      byLo: [...byLo.entries()].map(([userId, v]) => ({ userId, ...v })).sort((a, b) => b.volume - a.volume),
    };
  }, [loans, fees, expenses]);

  return (
    <div>
      <OpsPageHeader title="Production reports" subtitle="Funded volume, commission, and profitability" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Kpi title="Funded MTD" value={stats.mtd.count.toString()} sub={formatCurrency(stats.mtd.volume)} />
          <Kpi title="Funded YTD" value={stats.ytd.count.toString()} sub={formatCurrency(stats.ytd.volume)} />
          <Kpi title="House net YTD" value={formatCurrency(stats.ytd.house)} sub={`Gross ${formatCurrency(stats.ytd.gross)}`} />
          <Kpi title="Profit YTD" value={formatCurrency(stats.profitYtd)} sub={`Expenses ${formatCurrency(stats.expensesYtd)}`} accent />
        </div>

        <Card>
          <CardHeader><CardTitle>Production by loan officer (YTD)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-panel/40 border-b border-border text-left">
                <tr>
                  <th className="px-4 py-2">Loan officer</th>
                  <th className="px-4 py-2">Loans</th>
                  <th className="px-4 py-2">Volume</th>
                  <th className="px-4 py-2">Gross commission</th>
                  <th className="px-4 py-2">LO net</th>
                </tr>
              </thead>
              <tbody>
                {stats.byLo.map((row) => (
                  <tr key={row.userId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium">{row.userId === "unassigned" ? "Unassigned" : staffNameByUserId(profiles, row.userId)}</td>
                    <td className="px-4 py-2">{row.loanCount}</td>
                    <td className="px-4 py-2 font-mono">{formatCurrency(row.volume)}</td>
                    <td className="px-4 py-2 font-mono">{formatCurrency(row.gross)}</td>
                    <td className="px-4 py-2 font-mono text-cyan">{formatCurrency(row.loNet)}</td>
                  </tr>
                ))}
                {stats.byLo.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-10">No funded loans yet.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ title, value, sub, accent }: { title: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className={`mt-1 font-mono text-2xl ${accent ? "text-cyan" : ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
