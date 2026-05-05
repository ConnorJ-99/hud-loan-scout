import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  COMP_MODES, FEE_RECIPIENT_ROLES, FEE_DEDUCT_FROM,
  formatCurrency, type CompMode, type FeeDeductFrom, type FeeRecipientRole, computeFeeAmount,
} from "@/lib/ops/loan-helpers";
import { fetchStaffProfiles, staffName } from "@/lib/ops/profiles";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Fee = {
  id: string;
  loan_id: string;
  recipient_user_id: string | null;
  recipient_role: FeeRecipientRole;
  label: string | null;
  amount_mode: CompMode;
  flat_amount: number;
  pct_of_gross: number;
  deduct_from: FeeDeductFrom;
  notes: string | null;
};

export function LoanFeesEditor({ loanId, gross, canEdit }: { loanId: string; gross: number; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: profiles = [] } = useQuery({ queryKey: ["ops-staff"], queryFn: () => fetchStaffProfiles() });

  const { data: fees = [] } = useQuery({
    queryKey: ["ops-loan-fees", loanId],
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_fees").select("*").eq("loan_id", loanId).order("created_at");
      if (error) throw error;
      return (data ?? []) as Fee[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Fee> }) => {
      const { error } = await supabase.from("loan_fees").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops-loan-fees", loanId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("loan_fees").insert({
        loan_id: loanId, recipient_role: "processor", amount_mode: "flat",
        flat_amount: 0, pct_of_gross: 0, deduct_from: "house_split",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops-loan-fees", loanId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loan_fees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ops-loan-fees", loanId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {fees.length === 0 && <div className="text-sm text-muted-foreground">No referral or processor fees on this loan.</div>}
      {fees.map((f) => {
        const amt = computeFeeAmount(f, gross);
        return (
          <div key={f.id} className="rounded-md border border-border p-3 space-y-3 bg-panel/40">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Recipient role</Label>
                <Select disabled={!canEdit} value={f.recipient_role}
                  onValueChange={(v) => update.mutate({ id: f.id, patch: { recipient_role: v as FeeRecipientRole } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEE_RECIPIENT_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Recipient (staff)</Label>
                <Select disabled={!canEdit} value={f.recipient_user_id ?? "__none"}
                  onValueChange={(v) => update.mutate({ id: f.id, patch: { recipient_user_id: v === "__none" ? null : v } })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{staffName(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label / note</Label>
                <Input disabled={!canEdit} defaultValue={f.label ?? ""} placeholder="e.g. Processing"
                  onBlur={(e) => e.target.value !== (f.label ?? "") && update.mutate({ id: f.id, patch: { label: e.target.value || null } })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount type</Label>
                <Select disabled={!canEdit} value={f.amount_mode}
                  onValueChange={(v) => update.mutate({ id: f.id, patch: { amount_mode: v as CompMode } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMP_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {f.amount_mode === "flat" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Flat amount ($)</Label>
                  <Input disabled={!canEdit} type="number" defaultValue={Number(f.flat_amount ?? 0)}
                    onBlur={(e) => update.mutate({ id: f.id, patch: { flat_amount: Number(e.target.value) || 0 } })} />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">% of gross commission</Label>
                  <Input disabled={!canEdit} type="number" step="0.01"
                    defaultValue={(Number(f.pct_of_gross ?? 0) * 100).toFixed(2)}
                    onBlur={(e) => update.mutate({ id: f.id, patch: { pct_of_gross: (Number(e.target.value) || 0) / 100 } })} />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Deduct from</Label>
                <Select disabled={!canEdit} value={f.deduct_from}
                  onValueChange={(v) => update.mutate({ id: f.id, patch: { deduct_from: v as FeeDeductFrom } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEE_DEDUCT_FROM.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Calculated</Label>
                <div className="h-10 flex items-center font-mono text-sm">{formatCurrency(amt)}</div>
              </div>
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(f.id)}>
                  <Trash2 className="size-4 text-red-500 mr-1" /> Remove
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {canEdit && (
        <Button size="sm" variant="outline" onClick={() => add.mutate()} disabled={add.isPending}>
          + Add fee
        </Button>
      )}
    </div>
  );
}
