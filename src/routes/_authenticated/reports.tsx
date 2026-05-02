import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/loaniq/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { FileBarChart, Search, Calculator } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — LoanIQ" }] }),
  component: Reports,
});

interface SearchRow { id: string; nickname: string | null; top_lender: string | null; top_product: string | null; match_count: number | null; created_at: string }
interface AnalysisRow { id: string; borrower_name: string; analysis_type: string; status: string; qualifying_monthly_income: number | null; updated_at: string }

function Reports() {
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("loan_searches").select("id, nickname, top_lender, top_product, match_count, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("income_analyses").select("id, borrower_name, analysis_type, status, qualifying_monthly_income, updated_at").order("updated_at", { ascending: false }).limit(50),
    ]).then(([s, a]) => {
      setSearches((s.data ?? []) as SearchRow[]);
      setAnalyses((a.data ?? []) as AnalysisRow[]);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Loan searches & income analyses" />
      <div className="px-6 py-6 space-y-5 max-w-[1400px]">
        <section className="hud-panel rounded-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-cyan" />
            <span className="text-hud text-xs text-cyan">LOAN SEARCH REPORTS</span>
          </div>
          {loading ? <p className="text-mono text-xs text-muted-foreground">Loading...</p> : searches.length === 0 ? (
            <p className="text-mono text-xs text-muted-foreground py-4 text-center">&gt; No loan searches yet.</p>
          ) : (
            <div className="space-y-1.5">
              {searches.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-sm border border-border bg-background/40 p-2.5">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{s.nickname || "Scenario"}</div>
                    <div className="text-mono text-[10px] text-muted-foreground truncate">
                      {s.top_lender ? `${s.top_lender} — ${s.top_product}` : "No top match"} · {s.match_count ?? 0} matches
                    </div>
                  </div>
                  <div className="text-mono text-[10px] text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="hud-panel rounded-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-4 w-4 text-cyan" />
            <span className="text-hud text-xs text-cyan">INCOME ANALYSIS REPORTS</span>
          </div>
          {loading ? <p className="text-mono text-xs text-muted-foreground">Loading...</p> : analyses.length === 0 ? (
            <p className="text-mono text-xs text-muted-foreground py-4 text-center">&gt; No analyses yet.</p>
          ) : (
            <div className="space-y-1.5">
              {analyses.map((a) => (
                <Link
                  key={a.id}
                  to={"/income-analyzer/$id" as never}
                  params={{ id: a.id } as never}
                  className="flex items-center justify-between rounded-sm border border-border bg-background/40 p-2.5 hover:border-cyan/60 transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm truncate">{a.borrower_name}</div>
                    <div className="text-mono text-[10px] text-muted-foreground truncate">
                      {a.analysis_type} · {a.status}
                      {a.qualifying_monthly_income ? ` · $${Number(a.qualifying_monthly_income).toLocaleString()}/mo` : ""}
                    </div>
                  </div>
                  <FileBarChart className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
