import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { LEAD_SOURCES, LEAD_STATUSES, formatDate, labelFor, leadStatusBadgeClass, type LeadStatus } from "@/lib/ops/loan-helpers";
import { fetchStaffProfiles, staffName } from "@/lib/ops/profiles";
import { MoveToTrackingDialog } from "@/components/ops/MoveToTrackingDialog";
import { ArrowLeft, ArrowRightCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ops/leads/$id")({
  component: LeadDetail,
});

function LeadDetail() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [moveOpen, setMoveOpen] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["ops-lead", id],
    queryFn: async () => (await supabase.from("leads").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["ops-staff"], queryFn: () => fetchStaffProfiles() });

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("leads").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["ops-lead", id] });
      qc.invalidateQueries({ queryKey: ["ops-leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!lead) return <div className="p-6 text-muted-foreground">Lead not found.</div>;

  const canEdit = isAdmin || lead.assigned_lo === user?.id;
  const alreadyConverted = !!lead.converted_loan_id;

  return (
    <div>
      <OpsPageHeader
        title={lead.name}
        subtitle={`Source: ${labelFor(LEAD_SOURCES, lead.source)} • Received ${formatDate(lead.created_at)}`}
        actions={
          <div className="flex gap-2">
            <Link to="/ops/leads" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="size-4" /> Back
            </Link>
            {alreadyConverted ? (
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/ops/loans/$id", params: { id: lead.converted_loan_id! } })}>
                View tracked loan
              </Button>
            ) : (
              <Button size="sm" onClick={() => setMoveOpen(true)} disabled={!canEdit}>
                <ArrowRightCircle className="size-4 mr-1" /> Move to tracking
              </Button>
            )}
          </div>
        }
      />
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name">
              <Input disabled={!canEdit} defaultValue={lead.name}
                onBlur={(e) => e.target.value !== lead.name && update.mutate({ name: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select disabled={!canEdit} value={lead.status}
                onValueChange={(v) => update.mutate({ status: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs border ${leadStatusBadgeClass(lead.status)}`}>
                {labelFor(LEAD_STATUSES, lead.status)}
              </span>
            </Field>
            <Field label="Phone">
              <Input disabled={!canEdit} defaultValue={lead.phone ?? ""}
                onBlur={(e) => update.mutate({ phone: e.target.value || null })} />
            </Field>
            <Field label="Email">
              <Input disabled={!canEdit} defaultValue={lead.email ?? ""}
                onBlur={(e) => update.mutate({ email: e.target.value || null })} />
            </Field>
            <Field label="Assigned loan officer">
              <Select disabled={!isAdmin} value={lead.assigned_lo ?? "__none"}
                onValueChange={(v) => update.mutate({ assigned_lo: v === "__none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Unassigned</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{staffName(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Source">
              <div className="h-10 flex items-center text-sm">{labelFor(LEAD_SOURCES, lead.source)}</div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea rows={4} disabled={!canEdit} defaultValue={lead.notes ?? ""}
                  onBlur={(e) => update.mutate({ notes: e.target.value || null })} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Raw payload</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-panel/40 p-3 rounded overflow-auto max-h-[400px]">
              {JSON.stringify(lead.raw_payload ?? {}, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      <MoveToTrackingDialog
        lead={lead}
        open={moveOpen}
        onOpenChange={setMoveOpen}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
