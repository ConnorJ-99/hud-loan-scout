import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OpsPageHeader } from "@/components/ops/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchStaffProfiles, staffName, staffNameByUserId } from "@/lib/ops/profiles";
import { COMP_PLANS, formatCurrency, type CompPlan } from "@/lib/ops/loan-helpers";
import { Plus, Trash2, Download, Zap } from "lucide-react";
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

function PayrollPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [form, setForm] = useState({ user_id: "", pay_period: firstOfMonth, salary_amount: "", draw_amount: "", paid_on: today, frequency: "monthly", notes: "" });

  const { data: profiles = [] } = useQuery({
    queryKey: ["ops-staff"],
    queryFn: () => fetchStaffProfiles("monthly_salary, monthly_draw, comp_plan, pay_frequency, pay_day"),
  });
  const { data: payouts = [] } = useQuery({
    queryKey: ["ops-payouts"],
    queryFn: async () => (await supabase.from("salary_payouts").select("*").order("pay_period", { ascending: false })).data ?? [],
  });

  const openPayoutFor = (user_id: string) => {
    const p = profiles.find((x) => x.user_id === user_id);
    setForm({
      user_id,
      pay_period: firstOfMonth,
      salary_amount: p ? String(Number(p.monthly_salary ?? 0)) : "",
      draw_amount: p ? String(Number(p.monthly_draw ?? 0)) : "",
      paid_on: today,
      frequency: (p?.pay_frequency as string) || "monthly",
      notes: "",
    });
    setOpen(true);
  };

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

  const addPayout = useMutation({
    mutationFn: async () => {
      const noteWithFreq = [form.frequency ? `Frequency: ${form.frequency}` : "", form.notes].filter(Boolean).join(" | ");
      const { error } = await supabase.from("salary_payouts").insert({
        user_id: form.user_id,
        pay_period: form.pay_period,
        salary_amount: Number(form.salary_amount) || 0,
        draw_amount: Number(form.draw_amount) || 0,
        paid_on: form.paid_on || null,
        notes: noteWithFreq || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout recorded");
      setOpen(false);
      setForm({ user_id: "", pay_period: firstOfMonth, salary_amount: "", draw_amount: "", paid_on: today, frequency: "monthly", notes: "" });
      qc.invalidateQueries({ queryKey: ["ops-payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePayout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("salary_payouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops-payouts"] }),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("salary_payouts").update({ paid_on: today }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked paid"); qc.invalidateQueries({ queryKey: ["ops-payouts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const runAuto = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/public/hooks/auto-payroll", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json as { created: number };
    },
    onSuccess: (r) => {
      toast.success(`Auto-payroll: ${r.created} new pending payout${r.created === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["ops-payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <OpsPageHeader
        title="Payroll"
        subtitle="Automatic payouts run nightly. All fields editable inline."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => runAuto.mutate()} disabled={runAuto.isPending}>
              <Zap className="h-4 w-4 mr-1" /> {runAuto.isPending ? "Running…" : "Run auto-payroll now"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              const csv = toCsv(payouts.map((p) => ({
                staff: staffNameByUserId(profiles, p.user_id),
                pay_period: p.pay_period,
                salary: Number(p.salary_amount ?? 0).toFixed(2),
                draw: Number(p.draw_amount ?? 0).toFixed(2),
                paid_on: p.paid_on ?? "",
                notes: p.notes ?? "",
              })));
              downloadCsv(`payouts-${today}.csv`, csv);
            }}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4 mr-1" /> Record payout</Button>
          </div>
        }
      />
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border text-sm font-medium">Staff comp plans</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-panel/40 border-b border-border text-left">
                  <tr>
                    <th className="px-4 py-2">Staff</th>
                    <th className="px-4 py-2">Plan</th>
                    <th className="px-4 py-2">Monthly salary</th>
                    <th className="px-4 py-2">Monthly draw</th>
                    <th className="px-4 py-2">Frequency</th>
                    <th className="px-4 py-2">Pay day</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.user_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">{staffName(p)}</td>
                      <td className="px-4 py-2">
                        <Select value={(p.comp_plan as CompPlan) ?? "commission_only"}
                          onValueChange={(v) => updateProfile.mutate({ user_id: p.user_id, patch: { comp_plan: v } })}>
                          <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{COMP_PLANS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-2">
                        <Input type="number" className="h-8 w-32" defaultValue={Number(p.monthly_salary ?? 0)}
                          onBlur={(e) => updateProfile.mutate({ user_id: p.user_id, patch: { monthly_salary: Number(e.target.value) || 0 } })} />
                      </td>
                      <td className="px-4 py-2">
                        <Input type="number" className="h-8 w-32" defaultValue={Number(p.monthly_draw ?? 0)}
                          onBlur={(e) => updateProfile.mutate({ user_id: p.user_id, patch: { monthly_draw: Number(e.target.value) || 0 } })} />
                      </td>
                      <td className="px-4 py-2">
                        <Select value={(p.pay_frequency as string) || "monthly"}
                          onValueChange={(v) => updateProfile.mutate({ user_id: p.user_id, patch: { pay_frequency: v } })}>
                          <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-2">
                        <Input type="number" min="1" max="28" className="h-8 w-20" placeholder="—"
                          defaultValue={p.pay_day ?? ""}
                          onBlur={(e) => updateProfile.mutate({ user_id: p.user_id, patch: { pay_day: e.target.value === "" ? null : Number(e.target.value) } })} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => openPayoutFor(p.user_id)}>
                          <Plus className="size-3 mr-1" /> Pay
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border">
              Auto-payroll runs nightly and creates pending payouts for each staff member based on their frequency and pay day.
              Weekly = each Friday • Bi-Weekly = every other Friday • Semi-Monthly = pay day & pay day+15 • Monthly = pay day each month.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border text-sm font-medium">Payout history (all fields editable)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-panel/40 border-b border-border text-left">
                  <tr>
                    <th className="px-4 py-2">Staff</th>
                    <th className="px-4 py-2">Pay period</th>
                    <th className="px-4 py-2">Salary</th>
                    <th className="px-4 py-2">Draw</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Paid on</th>
                    <th className="px-4 py-2">Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <Select value={p.user_id}
                          onValueChange={(v) => updatePayout.mutate({ id: p.id, patch: { user_id: v } })}>
                          <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {profiles.map((sp) => <SelectItem key={sp.user_id} value={sp.user_id}>{staffName(sp)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-2">
                        <Input type="date" className="h-8 w-36" defaultValue={p.pay_period ?? ""}
                          onBlur={(e) => e.target.value !== p.pay_period && updatePayout.mutate({ id: p.id, patch: { pay_period: e.target.value } })} />
                      </td>
                      <td className="px-4 py-2">
                        <Input type="number" className="h-8 w-28 font-mono" defaultValue={Number(p.salary_amount ?? 0)}
                          onBlur={(e) => updatePayout.mutate({ id: p.id, patch: { salary_amount: Number(e.target.value) || 0 } })} />
                      </td>
                      <td className="px-4 py-2">
                        <Input type="number" className="h-8 w-28 font-mono" defaultValue={Number(p.draw_amount ?? 0)}
                          onBlur={(e) => updatePayout.mutate({ id: p.id, patch: { draw_amount: Number(e.target.value) || 0 } })} />
                      </td>
                      <td className="px-4 py-2">
                        {p.paid_on ? (
                          <span className="inline-block rounded px-2 py-0.5 text-xs bg-emerald-500/15 text-emerald-300">Paid</span>
                        ) : (
                          <span className="inline-block rounded px-2 py-0.5 text-xs bg-amber-500/15 text-amber-300">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Input type="date" className="h-8 w-36" defaultValue={p.paid_on ?? ""}
                          onBlur={(e) => updatePayout.mutate({ id: p.id, patch: { paid_on: e.target.value || null } })} />
                      </td>
                      <td className="px-4 py-2">
                        <Input className="h-8 w-48" defaultValue={p.notes ?? ""}
                          onBlur={(e) => updatePayout.mutate({ id: p.id, patch: { notes: e.target.value || null } })} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {!p.paid_on && (
                            <Button size="sm" variant="outline" onClick={() => markPaid.mutate(p.id)}>Mark paid</Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => removePayout.mutate(p.id)}>
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {payouts.length === 0 && <tr><td colSpan={8} className="text-center text-muted-foreground py-10">No payouts yet. Set monthly salary/draw + frequency above and the nightly job will create them.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record salary payout</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Staff</Label>
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{staffName(p)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Pay period</Label>
                <Input type="date" value={form.pay_period} onChange={(e) => setForm({ ...form, pay_period: e.target.value })} /></div>
              <div className="space-y-1"><Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Salary ($)</Label>
                <Input type="number" value={form.salary_amount} onChange={(e) => setForm({ ...form, salary_amount: e.target.value })} /></div>
              <div className="space-y-1"><Label>Draw ($)</Label>
                <Input type="number" value={form.draw_amount} onChange={(e) => setForm({ ...form, draw_amount: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Paid on</Label>
              <Input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} />
              <p className="text-xs text-muted-foreground">Leave blank to record as Pending; mark paid later.</p>
            </div>
            <div className="space-y-1"><Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">{formatCurrency(Number(form.salary_amount || 0) + Number(form.draw_amount || 0))} total</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => addPayout.mutate()} disabled={!form.user_id || !form.pay_period || addPayout.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
