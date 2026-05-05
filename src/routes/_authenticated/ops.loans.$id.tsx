import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { OpsPageHeader } from "@/components/ops/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoanFeesEditor } from "@/components/ops/LoanFeesEditor";
import { fetchStaffProfiles, staffName, staffNameByUserId } from "@/lib/ops/profiles";
import {
  COMP_MODES, LOAN_STAGES, computeBreakdown, formatCurrency, formatDate,
  labelFor, loanStageBadgeClass, type CompMode, type LoanStage,
} from "@/lib/ops/loan-helpers";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ops/loans/$id")({
  component: LoanDetail,
});

function LoanDetail() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: loan, isLoading } = useQuery({
    queryKey: ["ops-loan", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("loans").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["ops-staff"], queryFn: () => fetchStaffProfiles() });
  const { data: fees = [] } = useQuery({
    queryKey: ["ops-loan-fees", id],
    queryFn: async () => (await supabase.from("loan_fees").select("*").eq("loan_id", id)).data ?? [],
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["ops-loan-notes", id],
    queryFn: async () =>
      (await supabase.from("loan_notes").select("*").eq("loan_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: history = [] } = useQuery({
    queryKey: ["ops-loan-history", id],
    queryFn: async () =>
      (await supabase.from("loan_stage_history").select("*").eq("loan_id", id).order("changed_at", { ascending: false })).data ?? [],
  });

  const canEdit = isAdmin || (loan && loan.assigned_lo === user?.id);
  const [noteDraft, setNoteDraft] = useState("");

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("loans").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["ops-loan", id] });
      qc.invalidateQueries({ queryKey: ["ops-loan-history", id] });
      qc.invalidateQueries({ queryKey: ["ops-loans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("loan_notes").insert({ loan_id: id, author_id: user.id, body: noteDraft.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteDraft("");
      qc.invalidateQueries({ queryKey: ["ops-loan-notes", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!loan) return <div className="p-6 text-muted-foreground">Loan not found.</div>;

  const breakdown = computeBreakdown(
    {
      loan_amount: Number(loan.loan_amount ?? 0),
      comp_mode: loan.comp_mode as CompMode,
      comp_points: Number(loan.comp_points ?? 0),
      comp_flat_amount: Number(loan.comp_flat_amount ?? 0),
      lo_split_pct: Number(loan.lo_split_pct ?? 0),
      house_split_pct: Number(loan.house_split_pct ?? 0),
    },
    fees.map((f) => ({
      amount_mode: f.amount_mode,
      flat_amount: Number(f.flat_amount ?? 0),
      pct_of_gross: Number(f.pct_of_gross ?? 0),
      deduct_from: f.deduct_from,
    })),
  );

  return (
    <div>
      <OpsPageHeader
        title={loan.borrower_name}
        subtitle={`${loan.loan_type || "—"} • ${formatCurrency(Number(loan.loan_amount ?? 0))}`}
        actions={
          <Link to="/ops/loans" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-4" /> Back
          </Link>
        }
      />
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Loan</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Borrower">
                <Input disabled={!canEdit} defaultValue={loan.borrower_name}
                  onBlur={(e) => e.target.value !== loan.borrower_name && update.mutate({ borrower_name: e.target.value })} />
              </Field>
              <Field label="Loan type">
                <Input disabled={!canEdit} defaultValue={loan.loan_type ?? ""}
                  onBlur={(e) => update.mutate({ loan_type: e.target.value || null })} />
              </Field>
              <Field label="Loan amount ($)">
                <Input disabled={!canEdit} type="number" defaultValue={Number(loan.loan_amount ?? 0)}
                  onBlur={(e) => update.mutate({ loan_amount: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Stage">
                <Select disabled={!canEdit} value={loan.stage}
                  onValueChange={(v) => update.mutate({ stage: v as LoanStage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOAN_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs ${loanStageBadgeClass(loan.stage)}`}>
                  {labelFor(LOAN_STAGES, loan.stage)}
                </span>
              </Field>
              <Field label="Assigned loan officer">
                <Select disabled={!isAdmin} value={loan.assigned_lo ?? "__none"}
                  onValueChange={(v) => update.mutate({ assigned_lo: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{staffName(p)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Expected close">
                <Input disabled={!canEdit} type="date" defaultValue={loan.expected_close_date ?? ""}
                  onBlur={(e) => update.mutate({ expected_close_date: e.target.value || null })} />
              </Field>
              <Field label="Actual close">
                <Input disabled={!canEdit} type="date" defaultValue={loan.actual_close_date ?? ""}
                  onBlur={(e) => update.mutate({ actual_close_date: e.target.value || null })} />
              </Field>
              <Field label="Borrower phone">
                <Input disabled={!canEdit} defaultValue={loan.borrower_phone ?? ""}
                  onBlur={(e) => update.mutate({ borrower_phone: e.target.value || null })} />
              </Field>
              <Field label="Borrower email">
                <Input disabled={!canEdit} defaultValue={loan.borrower_email ?? ""}
                  onBlur={(e) => update.mutate({ borrower_email: e.target.value || null })} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Compensation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Comp mode">
                  <Select disabled={!canEdit} value={loan.comp_mode}
                    onValueChange={(v) => update.mutate({ comp_mode: v as CompMode })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMP_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                {loan.comp_mode === "flat" ? (
                  <Field label="Flat comp ($)">
                    <Input disabled={!canEdit} type="number" defaultValue={Number(loan.comp_flat_amount ?? 0)}
                      onBlur={(e) => update.mutate({ comp_flat_amount: Number(e.target.value) || 0 })} />
                  </Field>
                ) : (
                  <Field label="Comp points (%)">
                    <Input disabled={!canEdit} type="number" step="0.01" defaultValue={Number(loan.comp_points ?? 0)}
                      onBlur={(e) => update.mutate({ comp_points: Number(e.target.value) || 0, lo_comp_pct: (Number(e.target.value) || 0) / 100 })} />
                  </Field>
                )}
                <Field label="Gross commission">
                  <div className="h-10 flex items-center font-mono text-sm">{formatCurrency(breakdown.grossCommission)}</div>
                </Field>
                <Field label="LO Split (%)">
                  <Input disabled={!canEdit} type="number" step="0.01"
                    defaultValue={(Number(loan.lo_split_pct ?? 0) * 100).toFixed(2)}
                    onBlur={(e) => update.mutate({ lo_split_pct: (Number(e.target.value) || 0) / 100 })} />
                </Field>
                <Field label="House Split (%)">
                  <Input disabled={!canEdit} type="number" step="0.01"
                    defaultValue={(Number(loan.house_split_pct ?? 0) * 100).toFixed(2)}
                    onBlur={(e) => update.mutate({ house_split_pct: (Number(e.target.value) || 0) / 100 })} />
                </Field>
              </div>

              <div className="rounded-md border border-border bg-panel/40 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Gross" value={formatCurrency(breakdown.grossCommission)} />
                <Stat label="LO before fees" value={formatCurrency(breakdown.loBeforeFees)} />
                <Stat label="House before fees" value={formatCurrency(breakdown.houseBeforeFees)} />
                <Stat label="Total fees" value={formatCurrency(breakdown.totalFees)} />
                <Stat label="LO net" value={formatCurrency(breakdown.loNet)} accent />
                <Stat label="House net" value={formatCurrency(breakdown.houseNet)} accent />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Fees & referrals</CardTitle></CardHeader>
            <CardContent>
              <LoanFeesEditor loanId={id} gross={breakdown.grossCommission} canEdit={!!canEdit} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={3} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add a note…" />
              <Button size="sm" disabled={!noteDraft.trim() || addNote.isPending} onClick={() => addNote.mutate()}>
                {addNote.isPending ? "Saving…" : "Add note"}
              </Button>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-md border border-border bg-panel/30 p-2 text-sm">
                    <div className="text-xs text-muted-foreground">
                      {staffNameByUserId(profiles, n.author_id)} • {formatDate(n.created_at)}
                    </div>
                    <div className="whitespace-pre-wrap">{n.body}</div>
                  </div>
                ))}
                {notes.length === 0 && <div className="text-xs text-muted-foreground">No notes yet.</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Stage history</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="border-l-2 border-cyan/40 pl-3">
                    <div>{h.from_stage ? `${labelFor(LOAN_STAGES, h.from_stage)} → ` : ""}<b>{labelFor(LOAN_STAGES, h.to_stage)}</b></div>
                    <div className="text-xs text-muted-foreground">{staffNameByUserId(profiles, h.changed_by)} • {formatDate(h.changed_at)}</div>
                  </li>
                ))}
                {history.length === 0 && <div className="text-xs text-muted-foreground">No history.</div>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-mono text-base ${accent ? "text-cyan font-semibold" : ""}`}>{value}</div>
    </div>
  );
}
