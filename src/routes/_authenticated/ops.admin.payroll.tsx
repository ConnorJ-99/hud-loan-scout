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
import { COMP_PLANS, formatCurrency, formatDate, labelFor, type CompPlan } from "@/lib/ops/loan-helpers";
import { Plus, Trash2 } from "lucide-react";
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

function PayrollPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", pay_period: "", salary_amount: "", draw_amount: "", paid_on: "", notes: "" });

  const { data: profiles = [] } = useQuery({ queryKey: ["ops-staff"], queryFn: () => fetchStaffProfiles("monthly_salary, monthly_draw, comp_plan") });
  const { data: payouts = [] } = useQuery({
    queryKey: ["ops-payouts"],
    queryFn: async () => (await supabase.from("salary_payouts").select("*").order("pay_period", { ascending: false })).data ?? [],
  });

  const updateProfile = useMutation({
    mutationFn: async ({ user_id, patch }: { user_id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("profiles").update(patch as never).eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops-staff"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addPayout = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("salary_payouts").insert({
        user_id: form.user_id,
        pay_period: form.pay_period,
        salary_amount: Number(form.salary_amount) || 0,
        draw_amount: Number(form.draw_amount) || 0,
        paid_on: form.paid_on || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout recorded");
      setOpen(false);
      setForm({ user_id: "", pay_period: "", salary_amount: "", draw_amount: "", paid_on: "", notes: "" });
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

  return (
    <div>
      <OpsPageHeader
        title="Payroll"
        subtitle="Manage staff comp plans and record salary/draw payouts"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4 mr-1" /> Record payout</Button>}
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
                    <th className="px-4 py-2">Default LO split (%)</th>
                    <th className="px-4 py-2">Default house split (%)</th>
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
                        <Input type="number" step="0.01" className="h-8 w-24" defaultValue={(Number(p.default_lo_split_pct ?? 0) * 100).toFixed(2)}
                          onBlur={(e) => updateProfile.mutate({ user_id: p.user_id, patch: { default_lo_split_pct: (Number(e.target.value) || 0) / 100 } })} />
                      </td>
                      <td className="px-4 py-2">
                        <Input type="number" step="0.01" className="h-8 w-24" defaultValue={(Number(p.default_house_split_pct ?? 0) * 100).toFixed(2)}
                          onBlur={(e) => updateProfile.mutate({ user_id: p.user_id, patch: { default_house_split_pct: (Number(e.target.value) || 0) / 100 } })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border text-sm font-medium">Payout history</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-panel/40 border-b border-border text-left">
                  <tr>
                    <th className="px-4 py-2">Staff</th>
                    <th className="px-4 py-2">Pay period</th>
                    <th className="px-4 py-2">Salary</th>
                    <th className="px-4 py-2">Draw</th>
                    <th className="px-4 py-2">Paid on</th>
                    <th className="px-4 py-2">Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">{staffNameByUserId(profiles, p.user_id)}</td>
                      <td className="px-4 py-2">{formatDate(p.pay_period)}</td>
                      <td className="px-4 py-2 font-mono">{formatCurrency(Number(p.salary_amount ?? 0))}</td>
                      <td className="px-4 py-2 font-mono">{formatCurrency(Number(p.draw_amount ?? 0))}</td>
                      <td className="px-4 py-2 text-muted-foreground">{formatDate(p.paid_on)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{p.notes ?? "—"}</td>
                      <td className="px-4 py-2 text-right">
                        <Button size="icon" variant="ghost" onClick={() => removePayout.mutate(p.id)}>
                          <Trash2 className="size-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {payouts.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground py-10">No payouts recorded.</td></tr>}
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
              <div className="space-y-1"><Label>Pay period (1st of month)</Label>
                <Input type="date" value={form.pay_period} onChange={(e) => setForm({ ...form, pay_period: e.target.value })} /></div>
              <div className="space-y-1"><Label>Paid on</Label>
                <Input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Salary ($)</Label>
                <Input type="number" value={form.salary_amount} onChange={(e) => setForm({ ...form, salary_amount: e.target.value })} /></div>
              <div className="space-y-1"><Label>Draw ($)</Label>
                <Input type="number" value={form.draw_amount} onChange={(e) => setForm({ ...form, draw_amount: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
