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
import { EXPENSE_CATEGORIES, formatCurrency, formatDate, labelFor, type ExpenseCategory } from "@/lib/ops/loan-helpers";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ops/admin/expenses")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/ops" });
  },
  component: ExpensesPage,
});

function ExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "misc" as ExpenseCategory, amount: "", date_due: "", date_paid: "", is_recurring: false, recurrence: "", notes: "" });

  const { data: expenses = [] } = useQuery({
    queryKey: ["ops-expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*").order("date_due", { ascending: false, nullsFirst: false })).data ?? [],
  });

  const total = expenses.reduce((a, e) => a + Number(e.amount ?? 0), 0);

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({
        name: form.name.trim(),
        category: form.category,
        amount: Number(form.amount) || 0,
        date_due: form.date_due || null,
        date_paid: form.date_paid || null,
        is_recurring: form.is_recurring,
        recurrence: form.recurrence || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense added");
      setOpen(false);
      setForm({ name: "", category: "misc", amount: "", date_due: "", date_paid: "", is_recurring: false, recurrence: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["ops-expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops-expenses"] }),
  });

  return (
    <div>
      <OpsPageHeader
        title="Expenses"
        subtitle={`${expenses.length} entries • ${formatCurrency(total)} total`}
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4 mr-1" /> Add expense</Button>}
      />
      <div className="p-6">
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-panel/40 border-b border-border text-left">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Due</th>
                  <th className="px-4 py-2">Paid</th>
                  <th className="px-4 py-2">Recurring</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium">{e.name}</td>
                    <td className="px-4 py-2">{labelFor(EXPENSE_CATEGORIES, e.category)}</td>
                    <td className="px-4 py-2 font-mono">{formatCurrency(Number(e.amount ?? 0))}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(e.date_due)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(e.date_paid)}</td>
                    <td className="px-4 py-2 text-xs capitalize">{e.is_recurring ? (e.recurrence || "Yes") : "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => remove.mutate(e.id)}>
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground py-10">No expenses yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as ExpenseCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Amount ($)</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date due</Label>
                <Input type="date" value={form.date_due} onChange={(e) => setForm({ ...form, date_due: e.target.value })} /></div>
              <div className="space-y-1"><Label>Date paid</Label>
                <Input type="date" value={form.date_paid} onChange={(e) => setForm({ ...form, date_paid: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="rec" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked, recurrence: e.target.checked && !form.recurrence ? "monthly" : form.recurrence })} />
              <Label htmlFor="rec">Recurring</Label>
              {form.is_recurring && (
                <Select value={form.recurrence || "monthly"} onValueChange={(v) => setForm({ ...form, recurrence: v })}>
                  <SelectTrigger className="ml-2 w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1"><Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => add.mutate()} disabled={!form.name.trim() || add.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
