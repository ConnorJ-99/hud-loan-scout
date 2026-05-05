import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOAN_STAGES, LOAN_TYPES } from "@/lib/ops/loan-helpers";
import { fetchStaffProfiles, staffName } from "@/lib/ops/profiles";
import { useAuth } from "@/lib/auth/useAuth";
import { toast } from "sonner";

type Lead = {
  id: string; name: string; phone: string | null; email: string | null; assigned_lo: string | null;
  loan_amount: number | null; purchase_price: number | null; loan_type: string | null;
};

const DEFAULT_STAGE = "application"; // "Pre-Approved" equivalent

export function MoveToTrackingDialog({ lead, open, onOpenChange }: {
  lead: Lead | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [borrowerName, setBorrowerName] = useState("");
  const [loanType, setLoanType] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [expectedClose, setExpectedClose] = useState("");
  const [stage, setStage] = useState<string>(DEFAULT_STAGE);
  const [assignedLo, setAssignedLo] = useState<string>("");
  const [coPct, setCoPct] = useState("");
  const [revenue, setRevenue] = useState("");
  const [loSplit, setLoSplit] = useState("50");
  const [houseSplit, setHouseSplit] = useState("50");

  const { data: profiles = [] } = useQuery({ queryKey: ["ops-staff"], queryFn: () => fetchStaffProfiles() });

  // Prefill form whenever lead changes / dialog opens
  useEffect(() => {
    if (!lead || !open) return;
    setBorrowerName(lead.name ?? "");
    setLoanType(lead.loan_type ?? "");
    setLoanAmount(lead.loan_amount != null ? String(lead.loan_amount) : "");
    setPurchasePrice(lead.purchase_price != null ? String(lead.purchase_price) : "");
    setInterestRate("");
    setExpectedClose("");
    setStage(DEFAULT_STAGE);
    setAssignedLo(lead.assigned_lo ?? "");
    if (lead.assigned_lo) {
      const p = profiles.find((x) => x.user_id === lead.assigned_lo);
      const dflt = Number(p?.default_comp_pct ?? 0);
      setCoPct(dflt > 0 ? (dflt * 100).toFixed(3) : "");
      const lo = Number(p?.default_lo_split_pct ?? 0);
      const hs = Number(p?.default_house_split_pct ?? 0);
      setLoSplit(lo > 0 ? (lo * 100).toFixed(2) : "50");
      setHouseSplit(hs > 0 ? (hs * 100).toFixed(2) : "50");
    } else {
      setCoPct(""); setLoSplit("50"); setHouseSplit("50");
    }
    setRevenue("");
  }, [lead, open, profiles]);

  const handleAssignedLoChange = (v: string) => {
    setAssignedLo(v);
    const p = profiles.find((x) => x.user_id === v);
    const dflt = Number(p?.default_comp_pct ?? 0);
    if (dflt > 0) setCoPct((dflt * 100).toFixed(3));
    const lo = Number(p?.default_lo_split_pct ?? 0);
    const hs = Number(p?.default_house_split_pct ?? 0);
    if (lo > 0) setLoSplit((lo * 100).toFixed(2));
    if (hs > 0) setHouseSplit((hs * 100).toFixed(2));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!lead) throw new Error("No lead");
      const amount = Number(loanAmount) || 0;
      const pct = coPct === "" ? 0 : Number(coPct) / 100;
      const compAmount = amount * pct;
      const loSp = (Number(loSplit) || 0) / 100;
      const houseSp = (Number(houseSplit) || 0) / 100;

      const { data: loan, error: loanErr } = await supabase.from("loans").insert({
        borrower_name: borrowerName.trim(),
        borrower_phone: lead.phone,
        borrower_email: lead.email,
        loan_type: loanType || null,
        loan_amount: amount,
        purchase_price: purchasePrice ? Number(purchasePrice) : null,
        interest_rate: interestRate ? Number(interestRate) : null,
        assigned_lo: assignedLo || null,
        stage: stage as "application",
        expected_close_date: expectedClose || null,
        lo_comp_pct: pct,
        lo_comp_amount: compAmount,
        company_revenue: Number(revenue) || 0,
        source_lead_id: lead.id,
        comp_mode: "percentage",
        comp_points: pct * 100,
        gross_commission: compAmount,
        lo_split_pct: loSp,
        house_split_pct: houseSp,
      }).select().single();
      if (loanErr) throw loanErr;

      const { error: leadErr } = await supabase.from("leads")
        .update({ status: "moved_to_tracking", converted_loan_id: loan.id })
        .eq("id", lead.id);
      if (leadErr) throw leadErr;
      return loan;
    },
    onSuccess: () => {
      toast.success("Lead promoted to tracked loan");
      qc.invalidateQueries({ queryKey: ["ops-leads"] });
      qc.invalidateQueries({ queryKey: ["ops-loans"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Move to Tracking</DialogTitle>
          <DialogDescription>Convert this lead into a tracked loan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Borrower name</Label>
            <Input value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Loan type</Label>
              <Select value={loanType || "__none"} onValueChange={(v) => setLoanType(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {LOAN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Loan amount ($)</Label>
              <Input type="number" min="0" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Purchase price ($)</Label>
              <Input type="number" min="0" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} /></div>
            <div className="space-y-1"><Label>Interest rate (%)</Label>
              <Input type="number" min="0" step="0.001" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Expected close</Label>
              <Input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} /></div>
            <div className="space-y-1"><Label>Initial stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOAN_STAGES.filter((s) => s.value !== "lost").map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Assigned loan officer</Label>
            <Select value={assignedLo} onValueChange={handleAssignedLoChange}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{staffName(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>LO comp (%)</Label>
                  <Input type="number" min="0" step="0.01" placeholder="e.g. 1.25" value={coPct} onChange={(e) => setCoPct(e.target.value)} /></div>
                <div className="space-y-1"><Label>Company revenue ($)</Label>
                  <Input type="number" min="0" value={revenue} onChange={(e) => setRevenue(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>LO Split (%)</Label>
                  <Input type="number" min="0" max="100" step="0.01" value={loSplit} onChange={(e) => setLoSplit(e.target.value)} /></div>
                <div className="space-y-1"><Label>House Split (%)</Label>
                  <Input type="number" min="0" max="100" step="0.01" value={houseSplit} onChange={(e) => setHouseSplit(e.target.value)} /></div>
              </div>
              <p className="text-xs text-muted-foreground">Compensation fields are admin-only and locked once the loan is in tracking.</p>
            </>
          )}
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">Compensation, splits, and revenue will be set by an admin after promotion.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !borrowerName.trim()}>
            {mutation.isPending ? "Promoting…" : "Move to Tracking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
