import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { OpsPageHeader } from "@/components/ops/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVE_STAGES, LEAD_SOURCES, LOAN_STAGES, formatCurrency, loanStageBadgeClass, type LoanStage } from "@/lib/ops/loan-helpers";
import { Briefcase, DollarSign, TrendingUp, Inbox } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/")({
  component: OpsDashboard,
});

function OpsDashboard() {
  const { user, isAdmin } = useAuth();
  const scope = isAdmin ? "all" : user?.id ?? "self";

  const { data: loans = [] } = useQuery({
    queryKey: ["ops-loans-all", scope],
    queryFn: async () => {
      let q = supabase.from("loans").select("*");
      if (!isAdmin && user) q = q.eq("assigned_lo", user.id);
      return (await q).data ?? [];
    },
    enabled: !!user,
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["ops-leads-all", scope],
    queryFn: async () => {
      let q = supabase.from("leads").select("id, source, status, created_at");
      if (!isAdmin && user) q = q.eq("assigned_lo", user.id);
      return (await q).data ?? [];
    },
    enabled: !!user,
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
  const in60 = new Date(now); in60.setDate(in60.getDate() + 60);
  const in90 = new Date(now); in90.setDate(in90.getDate() + 90);

  const activeLoans = loans.filter((l) => (ACTIVE_STAGES as string[]).includes(l.stage));
  const activePipelineDollars = activeLoans.reduce((a, l) => a + Number(l.loan_amount ?? 0), 0);
  const projectedRevenue = activeLoans.reduce((a, l) => a + Number(l.company_revenue ?? 0), 0);
  const fundedLoans = loans.filter((l) => l.stage === "funded");
  const fundedYTD = fundedLoans.filter((l) => l.actual_close_date && new Date(l.actual_close_date) >= yearStart);
  const fundedMTD = fundedLoans.filter((l) => l.actual_close_date && new Date(l.actual_close_date) >= monthStart);

  const expClose = (until: Date) =>
    activeLoans.filter((l) => l.expected_close_date && new Date(l.expected_close_date) <= until && new Date(l.expected_close_date) >= now);
  const closings30 = expClose(in30), closings60 = expClose(in60), closings90 = expClose(in90);

  const byStage = LOAN_STAGES.filter((s) => s.value !== "lost").map((s) => {
    const items = loans.filter((l) => l.stage === s.value);
    return { stage: s.value as LoanStage, label: s.label, count: items.length, total: items.reduce((a, l) => a + Number(l.loan_amount ?? 0), 0) };
  });

  const totalLeads = leads.length;
  const trackedLeads = leads.filter((l) => l.status === "moved_to_tracking").length;
  const totalLoans = loans.length;
  const fundedTotal = fundedLoans.length;

  const last30 = new Date(now); last30.setDate(last30.getDate() - 30);
  const sourceCounts = LEAD_SOURCES.map((s) => ({
    source: s.label,
    count: leads.filter((l) => l.source === s.value && new Date(l.created_at) >= last30).length,
  }));

  return (
    <div>
      <OpsPageHeader title="Operations Dashboard" subtitle={isAdmin ? "All staff. Pipeline + lead intake." : "Your pipeline and assigned leads."} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Kpi icon={Briefcase} label="Active pipeline $" value={formatCurrency(activePipelineDollars)} sub={`${activeLoans.length} active loans`} />
          <Kpi icon={TrendingUp} label="Projected revenue" value={formatCurrency(projectedRevenue)} sub="From active loans" />
          <Kpi icon={DollarSign} label="Funded MTD" value={formatCurrency(fundedMTD.reduce((a, l) => a + Number(l.loan_amount ?? 0), 0))} sub={`${fundedMTD.length} loans this month`} />
          <Kpi icon={DollarSign} label="Funded YTD" value={formatCurrency(fundedYTD.reduce((a, l) => a + Number(l.loan_amount ?? 0), 0))} sub={`${fundedYTD.length} loans this year`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Expected closings</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ClosingRow label="Next 30 days" count={closings30.length} amount={closings30.reduce((a, l) => a + Number(l.loan_amount ?? 0), 0)} />
              <ClosingRow label="Next 60 days" count={closings60.length} amount={closings60.reduce((a, l) => a + Number(l.loan_amount ?? 0), 0)} />
              <ClosingRow label="Next 90 days" count={closings90.length} amount={closings90.reduce((a, l) => a + Number(l.loan_amount ?? 0), 0)} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-sm">Pipeline by stage</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {byStage.map((s) => (
                  <Link key={s.stage} to="/ops/loans" className="rounded-md border border-border bg-panel/40 p-3 hover:border-cyan transition-colors">
                    <div className={`inline-block rounded px-2 py-0.5 text-[11px] ${loanStageBadgeClass(s.stage)}`}>{s.label}</div>
                    <div className="text-lg font-semibold mt-2">{formatCurrency(s.total)}</div>
                    <div className="text-xs text-muted-foreground">{s.count} loans</div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Conversion funnel</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <FunnelRow label="Leads in" value={totalLeads} />
              <FunnelRow label="Moved to tracking" value={trackedLeads} pct={totalLeads ? trackedLeads / totalLeads : 0} />
              <FunnelRow label="Tracked loans" value={totalLoans} />
              <FunnelRow label="Funded" value={fundedTotal} pct={totalLoans ? fundedTotal / totalLoans : 0} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Inbox className="size-4" /> Lead volume (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sourceCounts.map((s) => (
                  <div key={s.source} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{s.source}</span>
                    <span className="font-semibold">{s.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold mt-2">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </CardContent></Card>
  );
}
function ClosingRow({ label, count, amount }: { label: string; count: number; amount: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <div className="font-semibold">{formatCurrency(amount)}</div>
        <div className="text-xs text-muted-foreground">{count} loans</div>
      </div>
    </div>
  );
}
function FunnelRow({ label, value, pct }: { label: string; value: number; pct?: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}{pct !== undefined ? <span className="text-xs text-muted-foreground ml-1">({Math.round(pct * 100)}%)</span> : null}</span>
    </div>
  );
}
