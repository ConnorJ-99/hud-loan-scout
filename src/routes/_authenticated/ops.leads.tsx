import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OpsPageHeader } from "@/components/ops/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LEAD_STATUSES, LEAD_SOURCES, formatCurrency, formatDate, labelFor, leadStatusBadgeClass, type LeadStatus, type LeadSource } from "@/lib/ops/loan-helpers";
import { fetchStaffProfiles, staffNameByUserId } from "@/lib/ops/profiles";
import { MoveToTrackingDialog } from "@/components/ops/MoveToTrackingDialog";
import { NewLeadDialog } from "@/components/ops/NewLeadDialog";
import { EditLeadDialog, type EditableLead } from "@/components/ops/EditLeadDialog";
import { useAuth } from "@/lib/auth/useAuth";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [movingLead, setMovingLead] = useState<{ id: string; name: string; phone: string | null; email: string | null; assigned_lo: string | null; loan_amount: number | null; purchase_price: number | null; loan_type: string | null } | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<EditableLead | null>(null);

  const { data: profiles = [] } = useQuery({ queryKey: ["ops-staff"], queryFn: () => fetchStaffProfiles() });
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["ops-leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => leads.filter((l) => {
    if (statusFilter === "active") {
      if (l.status === "moved_to_tracking" || l.status === "bad_lead" || l.status === "duplicate") return false;
    } else if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!`${l.name ?? ""} ${l.email ?? ""} ${l.phone ?? ""}`.toLowerCase().includes(s)) return false;
    }
    return true;
  }), [leads, statusFilter, sourceFilter, search]);

  const updateStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: LeadStatus }) => {
      const { error } = await supabase.from("leads").update({ status }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); setSelected(new Set()); qc.invalidateQueries({ queryKey: ["ops-leads"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignLo = useMutation({
    mutationFn: async ({ ids, lo }: { ids: string[]; lo: string | null }) => {
      const { error } = await supabase.from("leads").update({ assigned_lo: lo }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Assigned"); qc.invalidateQueries({ queryKey: ["ops-leads"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const allChecked = filtered.length > 0 && filtered.every((l) => selected.has(l.id));

  return (
    <div>
      <OpsPageHeader title="Lead Intake" subtitle="Raw leads from every source. Triage here — only promote real opportunities into Tracking."
        actions={
          <div className="flex gap-2">
            {isAdmin && <Button onClick={() => setNewLeadOpen(true)}>+ New Lead</Button>}
          </div>
        }
      />
      <div className="p-6 space-y-4">
        <Card>
          <CardContent className="pt-5 flex flex-wrap items-center gap-3">
            <Input placeholder="Search name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (default)</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
                {LEAD_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {LEAD_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground ml-auto">{filtered.length} of {leads.length} leads</div>
          </CardContent>
        </Card>

        {selected.size > 0 && (
          <Card><CardContent className="pt-5 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Select onValueChange={(v) => updateStatus.mutate({ ids: [...selected], status: v as LeadStatus })}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Set status…" /></SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.filter((s) => s.value !== "moved_to_tracking").map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => assignLo.mutate({ ids: [...selected], lo: v === "__none" ? null : v })}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Assign LO…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Unassign</SelectItem>
                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email || "Staff"}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
          </CardContent></Card>
        )}

        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-panel/40 border-b border-border">
                <tr className="text-left">
                  <th className="px-4 py-2 w-8">
                    <Checkbox checked={allChecked} onCheckedChange={(c) => setSelected(c ? new Set(filtered.map((l) => l.id)) : new Set())} />
                  </th>
                  <th className="px-4 py-2">Lead</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">Loan</th>
                  <th className="px-4 py-2">Assigned LO</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Created</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No leads. Configure a webhook in admin to start receiving leads.</td></tr>
                )}
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-b-0 hover:bg-panel/30">
                    <td className="px-4 py-3">
                      <Checkbox checked={selected.has(l.id)} onCheckedChange={(c) => {
                        const next = new Set(selected);
                        if (c) next.add(l.id); else next.delete(l.id);
                        setSelected(next);
                      }} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-xs text-muted-foreground">{l.email || l.phone || "—"}</div>
                    </td>
                    <td className="px-4 py-3">{labelFor(LEAD_SOURCES, l.source as LeadSource)}</td>
                    <td className="px-4 py-3">
                      <div>{l.loan_type || "—"}</div>
                      <div className="text-xs text-muted-foreground">{l.loan_amount ? formatCurrency(Number(l.loan_amount)) : "—"}</div>
                    </td>
                    <td className="px-4 py-3">{staffNameByUserId(profiles, l.assigned_lo)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={leadStatusBadgeClass(l.status as LeadStatus)}>
                        {labelFor(LEAD_STATUSES, l.status as LeadStatus)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(l.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" title="Edit"
                          onClick={() => setEditingLead({
                            id: l.id, name: l.name, phone: l.phone, email: l.email,
                            source: l.source as LeadSource, status: l.status as LeadStatus,
                            assigned_lo: l.assigned_lo,
                            loan_amount: l.loan_amount === null || l.loan_amount === undefined ? null : Number(l.loan_amount),
                            purchase_price: l.purchase_price === null || l.purchase_price === undefined ? null : Number(l.purchase_price),
                            loan_type: l.loan_type ?? null,
                            notes: l.notes ?? null,
                          })}>
                          <Pencil className="size-4" />
                        </Button>
                        {l.status !== "moved_to_tracking" && (
                          <Button size="sm" onClick={() => setMovingLead({
                            id: l.id, name: l.name, phone: l.phone, email: l.email, assigned_lo: l.assigned_lo,
                            loan_amount: l.loan_amount === null || l.loan_amount === undefined ? null : Number(l.loan_amount),
                            purchase_price: l.purchase_price === null || l.purchase_price === undefined ? null : Number(l.purchase_price),
                            loan_type: l.loan_type ?? null,
                          })}>
                            Move to Tracking
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      </div>

      <MoveToTrackingDialog lead={movingLead} open={!!movingLead} onOpenChange={(o) => { if (!o) setMovingLead(null); }} />
      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
      <EditLeadDialog lead={editingLead} open={!!editingLead} onOpenChange={(o) => { if (!o) setEditingLead(null); }} />
    </div>
  );
}
