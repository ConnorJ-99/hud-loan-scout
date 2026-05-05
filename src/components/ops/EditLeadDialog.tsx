import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LEAD_SOURCES, MANUAL_LEAD_SOURCES, LEAD_STATUSES, LOAN_TYPES,
  type LeadSource, type LeadStatus,
} from "@/lib/ops/loan-helpers";
import { fetchStaffProfiles, staffName } from "@/lib/ops/profiles";
import { toast } from "sonner";

export type EditableLead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  assigned_lo: string | null;
  loan_amount: number | null;
  purchase_price: number | null;
  loan_type: string | null;
  notes: string | null;
};

export function EditLeadDialog({ lead, open, onOpenChange }: {
  lead: EditableLead | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<EditableLead | null>(lead);

  useEffect(() => { setForm(lead); }, [lead]);

  const { data: profiles = [] } = useQuery({ queryKey: ["ops-staff"], queryFn: () => fetchStaffProfiles() });

  // Source options: prefer the manual list, but if the lead's current source
  // is a webhook-only one (ghl/zapier), include it so the Select can display it.
  const sourceOptions = (() => {
    if (form && !MANUAL_LEAD_SOURCES.find((s) => s.value === form.source)) {
      const extra = LEAD_SOURCES.find((s) => s.value === form.source);
      return extra ? [...MANUAL_LEAD_SOURCES, extra] : MANUAL_LEAD_SOURCES;
    }
    return MANUAL_LEAD_SOURCES;
  })();

  const save = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("No lead");
      const trimmed = form.name.trim();
      if (!trimmed) throw new Error("Name is required");
      const { error } = await supabase.from("leads").update({
        name: trimmed,
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        source: form.source,
        status: form.status,
        assigned_lo: form.assigned_lo,
        loan_amount: form.loan_amount,
        purchase_price: form.purchase_price,
        loan_type: form.loan_type || null,
        notes: form.notes?.trim() || null,
      }).eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead updated");
      qc.invalidateQueries({ queryKey: ["ops-leads"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!form) return null;
  const update = (patch: Partial<EditableLead>) => setForm({ ...form, ...patch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
          <DialogDescription>Update lead details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Name *</Label>
            <Input value={form.name} onChange={(e) => update({ name: e.target.value })} maxLength={120} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Phone</Label>
              <Input value={form.phone ?? ""} onChange={(e) => update({ phone: e.target.value })} maxLength={40} /></div>
            <div className="space-y-1"><Label>Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => update({ email: e.target.value })} maxLength={200} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => update({ source: v as LeadSource })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update({ status: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.filter((s) => s.value !== "moved_to_tracking").map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Assigned LO</Label>
            <Select value={form.assigned_lo ?? "__none"} onValueChange={(v) => update({ assigned_lo: v === "__none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Unassigned</SelectItem>
                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{staffName(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Loan amount ($)</Label>
              <Input type="number" min="0" value={form.loan_amount ?? ""}
                onChange={(e) => update({ loan_amount: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div className="space-y-1"><Label>Purchase price ($)</Label>
              <Input type="number" min="0" value={form.purchase_price ?? ""}
                onChange={(e) => update({ purchase_price: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div className="space-y-1"><Label>Loan type</Label>
              <Select value={form.loan_type || "__none"} onValueChange={(v) => update({ loan_type: v === "__none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {LOAN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Notes</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} maxLength={2000} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
