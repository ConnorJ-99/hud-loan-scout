import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OpsPageHeader } from "@/components/ops/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOAN_STAGES, PIPELINE_STAGES, formatCurrency, formatDate, labelFor, loanStageBadgeClass, type LoanStage } from "@/lib/ops/loan-helpers";
import { fetchStaffProfiles, staffNameByUserId } from "@/lib/ops/profiles";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ops/loans")({
  component: LoansPage,
});

function LoansPage() {
  const qc = useQueryClient();

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["ops-loans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loans").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["ops-staff"], queryFn: () => fetchStaffProfiles() });

  const setStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: LoanStage }) => {
      const { error } = await supabase.from("loans").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Stage updated"); qc.invalidateQueries({ queryKey: ["ops-loans"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <OpsPageHeader title="Tracked Loans" subtitle={`${loans.length} loans in tracking`} />
      <div className="p-6">
        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="mt-4">
            {isLoading ? <div className="text-muted-foreground text-sm">Loading…</div> : (
              <div className="flex gap-3 overflow-x-auto pb-4">
                {PIPELINE_STAGES.map((stage) => {
                  const items = loans.filter((l) => l.stage === stage);
                  const sum = items.reduce((a, l) => a + Number(l.loan_amount ?? 0), 0);
                  return (
                    <div key={stage} className="min-w-[260px] w-[260px] shrink-0">
                      <div className="rounded-t-md bg-panel/40 border border-b-0 border-border px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className={`inline-block rounded px-2 py-0.5 text-xs ${loanStageBadgeClass(stage)}`}>{labelFor(LOAN_STAGES, stage)}</span>
                          <span className="text-xs text-muted-foreground">{items.length}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{formatCurrency(sum)}</div>
                      </div>
                      <div className="rounded-b-md border border-border bg-panel/20 p-2 space-y-2 min-h-[300px]">
                        {items.map((l) => (
                          <div key={l.id} className="block rounded-md border border-border bg-panel/40 p-3">
                            <div className="font-medium text-sm truncate">{l.borrower_name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{l.loan_type || "—"}</div>
                            <div className="text-sm font-semibold mt-1">{formatCurrency(Number(l.loan_amount ?? 0))}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {staffNameByUserId(profiles, l.assigned_lo)} • {l.expected_close_date ? formatDate(l.expected_close_date) : "no close date"}
                            </div>
                          </div>
                        ))}
                        {items.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Empty</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="table" className="mt-4">
            <Card><CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-panel/40 border-b border-border">
                    <tr className="text-left">
                      <th className="px-4 py-2">Borrower</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Amount</th>
                      <th className="px-4 py-2">Stage</th>
                      <th className="px-4 py-2">LO</th>
                      <th className="px-4 py-2">Expected close</th>
                      <th className="px-4 py-2">Comp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((l) => (
                      <tr key={l.id} className="border-b border-border last:border-b-0 hover:bg-panel/30">
                        <td className="px-4 py-3 font-medium">{l.borrower_name}</td>
                        <td className="px-4 py-3">{l.loan_type || "—"}</td>
                        <td className="px-4 py-3">{formatCurrency(Number(l.loan_amount ?? 0))}</td>
                        <td className="px-4 py-3">
                          <Select value={l.stage} onValueChange={(v) => setStage.mutate({ id: l.id, stage: v as LoanStage })}>
                            <SelectTrigger className="h-7 w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LOAN_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">{staffNameByUserId(profiles, l.assigned_lo)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(l.expected_close_date)}</td>
                        <td className="px-4 py-3">{formatCurrency(Number(l.lo_comp_amount ?? 0))}</td>
                      </tr>
                    ))}
                    {loans.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No tracked loans yet. Promote a lead from Lead Intake.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
