import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MANUAL_LEAD_SOURCES, LEAD_STATUSES, LOAN_TYPES,
  type LeadSource, type LeadStatus,
} from "@/lib/ops/loan-helpers";
import { fetchStaffProfiles, staffName } from "@/lib/ops/profiles";
import { toast } from "sonner";

export function NewLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<LeadSource>("website");
  const [status, setStatus] = useState<LeadStatus>("new");
  const [assignedLo, setAssignedLo] = useState<string>("__none");
  const [loanAmount, setLoanAmount] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [loanType, setLoanType] = useState<string>("");
  const [notes, setNotes] = useState("");

  const { data: profiles = [] } = useQuery({ queryKey: ["ops-staff"], queryFn: () => fetchStaffProfiles() });

  const reset = () => {
    setName(""); setPhone(""); setEmail(""); setSource("website");
    setStatus("new"); setAssignedLo("__none"); setNotes("");
    setLoanAmount(""); setPurchasePrice(""); setLoanType("");
  };

  // Auto-map LO when email matches a staff member's email
  const handleEmailBlur = (val: string) => {
    if (assignedLo !== "__none") return;
    const lower = val.trim().toLowerCase();
    if (!lower) return;
    const match = profiles.find((p) => (p.email ?? "").toLowerCase() === lower);
    if (match) setAssignedLo(match.user_id);
  };

  const create = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name is required");
      const { error } = await supabase.from("leads").insert({
        name: trimmed,
        phone: phone.trim() || null,
        email: email.trim() || null,
        source, status,
        assigned_lo: assignedLo === "__none" ? null : assignedLo,
        notes: notes.trim() || null,
        loan_amount: loanAmount ? Number(loanAmount) : null,
        purchase_price: purchasePrice ? Number(purchasePrice) : null,
        loan_type: loanType || null,
        raw_payload: { manual: true },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead created");
      qc.invalidateQueries({ queryKey: ["ops-leads"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
          <DialogDescription>Manually add a lead for testing or off-channel intake.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} /></div>
            <div className="space-y-1"><Label>Email</Label>
              <Input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={(e) => handleEmailBlur(e.target.value)}
                maxLength={200} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MANUAL_LEAD_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
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
            <Select value={assignedLo} onValueChange={setAssignedLo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Unassigned</SelectItem>
                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{staffName(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Loan amount ($)</Label>
              <Input type="number" min="0" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} /></div>
            <div className="space-y-1"><Label>Purchase price ($)</Label>
              <Input type="number" min="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} /></div>
            <div className="space-y-1"><Label>Loan type</Label>
              <Select value={loanType || "__none"} onValueChange={(v) => setLoanType(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {LOAN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !name.trim()}>
            {create.isPending ? "Creating…" : "Create lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
