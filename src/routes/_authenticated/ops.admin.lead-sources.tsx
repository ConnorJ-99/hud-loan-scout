import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OpsPageHeader } from "@/components/ops/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LEAD_SOURCES, formatCurrency, labelFor, type LeadSource } from "@/lib/ops/loan-helpers";
import { downloadCsv, toCsv } from "@/lib/ops/csv";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ops/admin/lead-sources")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/ops" });
  },
  component: LeadSourcesReport,
});

type Row = {
  source: LeadSource;
  leads: number;
  tracked: number;
  funded: number;
  fundedVolume: number;
  houseRevenue: number;
  conversionPct: number;
};

function LeadSourcesReport() {
  const { data: leads = [] } = useQuery({
    queryKey: ["ops-leads-all"],
    queryFn: async () => (await supabase.from("leads").select("id, source, converted_loan_id")).data ?? [],
  });
  const { data: loans = [] } = useQuery({
    queryKey: ["ops-loans-all"],
    queryFn: async () => (await supabase.from("loans").select("id, source_lead_id, stage, loan_amount, gross_commission, house_split_pct")).data ?? [],
  });

  const rows: Row[] = useMemo(() => {
    const loanById = new Map(loans.map((l) => [l.id, l]));
    const buckets = new Map<LeadSource, Row>();
    for (const s of LEAD_SOURCES) {
      buckets.set(s.value, { source: s.value, leads: 0, tracked: 0, funded: 0, fundedVolume: 0, houseRevenue: 0, conversionPct: 0 });
    }
    for (const lead of leads) {
      const b = buckets.get(lead.source as LeadSource)!;
      b.leads += 1;
      if (lead.converted_loan_id) {
        b.tracked += 1;
        const loan = loanById.get(lead.converted_loan_id);
        if (loan && loan.stage === "funded") {
          b.funded += 1;
          b.fundedVolume += Number(loan.loan_amount ?? 0);
          b.houseRevenue += Number(loan.gross_commission ?? 0) * Number(loan.house_split_pct ?? 0);
        }
      }
    }
    for (const b of buckets.values()) b.conversionPct = b.leads > 0 ? b.funded / b.leads : 0;
    return Array.from(buckets.values()).sort((a, b) => b.fundedVolume - a.fundedVolume);
  }, [leads, loans]);

  const totals = rows.reduce(
    (acc, r) => ({
      leads: acc.leads + r.leads, tracked: acc.tracked + r.tracked,
      funded: acc.funded + r.funded, fundedVolume: acc.fundedVolume + r.fundedVolume,
      houseRevenue: acc.houseRevenue + r.houseRevenue,
    }),
    { leads: 0, tracked: 0, funded: 0, fundedVolume: 0, houseRevenue: 0 },
  );

  const exportCsv = () => {
    const csv = toCsv(rows.map((r) => ({
      source: labelFor(LEAD_SOURCES, r.source),
      leads: r.leads, tracked: r.tracked, funded: r.funded,
      funded_volume: r.fundedVolume.toFixed(2),
      house_revenue: r.houseRevenue.toFixed(2),
      conversion_pct: (r.conversionPct * 100).toFixed(2),
    })));
    downloadCsv(`lead-source-roi-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div>
      <OpsPageHeader
        title="Lead Source ROI"
        subtitle="Conversion funnel and revenue per intake source."
        actions={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>}
      />
      <div className="p-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Tracked</TableHead>
                  <TableHead className="text-right">Funded</TableHead>
                  <TableHead className="text-right">Conv %</TableHead>
                  <TableHead className="text-right">Funded Volume</TableHead>
                  <TableHead className="text-right">House Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.source}>
                    <TableCell>{labelFor(LEAD_SOURCES, r.source)}</TableCell>
                    <TableCell className="text-right">{r.leads}</TableCell>
                    <TableCell className="text-right">{r.tracked}</TableCell>
                    <TableCell className="text-right">{r.funded}</TableCell>
                    <TableCell className="text-right">{(r.conversionPct * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(r.fundedVolume)}</TableCell>
                    <TableCell className="text-right font-mono text-cyan">{formatCurrency(r.houseRevenue)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{totals.leads}</TableCell>
                  <TableCell className="text-right">{totals.tracked}</TableCell>
                  <TableCell className="text-right">{totals.funded}</TableCell>
                  <TableCell className="text-right">{totals.leads > 0 ? ((totals.funded / totals.leads) * 100).toFixed(1) : "0.0"}%</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totals.fundedVolume)}</TableCell>
                  <TableCell className="text-right font-mono text-cyan">{formatCurrency(totals.houseRevenue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
