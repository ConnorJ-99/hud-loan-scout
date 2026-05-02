import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/loaniq/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { Plus, Calculator, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/income-analyzer")({
  head: () => ({ meta: [{ title: "Income Analyzer — LoanIQ" }] }),
  component: IncomeAnalyzerList,
});

interface Row {
  id: string;
  borrower_name: string;
  analysis_type: string;
  status: string;
  qualifying_monthly_income: number | null;
  months_reviewed: number | null;
  expense_factor: number;
  updated_at: string;
}

function IncomeAnalyzerList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase
      .from("income_analyses")
      .select("id, borrower_name, analysis_type, status, qualifying_monthly_income, months_reviewed, expense_factor, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  async function createNew() {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("income_analyses")
      .insert({
        created_by: user.id,
        borrower_name: "New Borrower",
        analysis_type: "12-month bank statement",
        status: "draft",
      })
      .select("id")
      .single();
    setCreating(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/income-analyzer/$id" as never, params: { id: data.id } as never });
  }

  return (
    <div>
      <PageHeader
        title="Income Analyzer"
        subtitle="Bank statement income calculator"
        actions={
          <button
            onClick={createNew}
            disabled={creating}
            className="flex items-center gap-2 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20 transition disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            NEW ANALYSIS
          </button>
        }
      />
      <div className="px-6 py-6 max-w-[1400px]">
        {loading ? (
          <div className="text-mono text-sm text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="hud-panel rounded-md p-12 text-center">
            <Calculator className="h-10 w-10 text-cyan mx-auto mb-3" />
            <div className="text-hud text-cyan mb-1">NO ANALYSES YET</div>
            <p className="text-mono text-xs text-muted-foreground mb-4">
              &gt; Create a new analysis to upload bank statements and calculate qualifying income.
            </p>
            <button
              onClick={createNew}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-sm border border-cyan bg-cyan/10 px-4 py-2 text-hud text-xs text-cyan hover:bg-cyan/20 transition"
            >
              <Plus className="h-3.5 w-3.5" /> CREATE FIRST ANALYSIS
            </button>
          </div>
        ) : (
          <div className="hud-panel rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-panel/60">
                  <th className="text-left px-4 py-2.5 text-hud text-[10px] text-muted-foreground">BORROWER</th>
                  <th className="text-left px-4 py-2.5 text-hud text-[10px] text-muted-foreground">TYPE</th>
                  <th className="text-left px-4 py-2.5 text-hud text-[10px] text-muted-foreground">MONTHS</th>
                  <th className="text-left px-4 py-2.5 text-hud text-[10px] text-muted-foreground">EXPENSE %</th>
                  <th className="text-right px-4 py-2.5 text-hud text-[10px] text-muted-foreground">QUAL INCOME</th>
                  <th className="text-left px-4 py-2.5 text-hud text-[10px] text-muted-foreground">STATUS</th>
                  <th className="text-left px-4 py-2.5 text-hud text-[10px] text-muted-foreground">UPDATED</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-cyan/5 transition">
                    <td className="px-4 py-2.5">
                      <Link
                        to={"/income-analyzer/$id" as never}
                        params={{ id: r.id } as never}
                        className="text-foreground hover:text-cyan transition"
                      >
                        {r.borrower_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-mono text-xs text-muted-foreground">{r.analysis_type}</td>
                    <td className="px-4 py-2.5 text-mono text-xs">{r.months_reviewed ?? "—"}</td>
                    <td className="px-4 py-2.5 text-mono text-xs">{Math.round(Number(r.expense_factor) * 100)}%</td>
                    <td className="px-4 py-2.5 text-mono text-xs text-right text-success">
                      {r.qualifying_monthly_income ? `$${Number(r.qualifying_monthly_income).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-hud text-[9px] text-cyan uppercase">{r.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-mono text-[10px] text-muted-foreground">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
