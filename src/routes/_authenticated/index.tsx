import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/loaniq/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { Search, Calculator, Upload, UserPlus, Users, FileBarChart, Clock, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — LoanIQ" },
      { name: "description", content: "LoanIQ dashboard for MPS Mortgage. Recent borrower files, income analyses, and loan searches." },
    ],
  }),
  component: Dashboard,
});

interface BorrowerRow { id: string; borrower_name: string; status: string; updated_at: string; }
interface AnalysisRow { id: string; borrower_name: string; analysis_type: string; status: string; qualifying_monthly_income: number | null; updated_at: string; }
interface SearchRow { id: string; nickname: string | null; top_lender: string | null; top_product: string | null; match_count: number | null; created_at: string; }

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [borrowers, setBorrowers] = useState<BorrowerRow[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("borrower_files").select("id, borrower_name, status, updated_at").order("updated_at", { ascending: false }).limit(5),
      supabase.from("income_analyses").select("id, borrower_name, analysis_type, status, qualifying_monthly_income, updated_at").order("updated_at", { ascending: false }).limit(5),
      supabase.from("loan_searches").select("id, nickname, top_lender, top_product, match_count, created_at").order("created_at", { ascending: false }).limit(5),
    ]).then(([b, a, s]) => {
      setBorrowers((b.data ?? []) as BorrowerRow[]);
      setAnalyses((a.data ?? []) as AnalysisRow[]);
      setSearches((s.data ?? []) as SearchRow[]);
      setLoading(false);
    });
  }, [user]);

  async function quickCreateBorrower() {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("borrower_files")
      .insert({ created_by: user.id, borrower_name: "New Borrower", status: "active" })
      .select("id")
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/borrowers/$id" as never, params: { id: data.id } as never });
  }

  async function quickCreateAnalysis() {
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
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/income-analyzer/$id" as never, params: { id: data.id } as never });
  }

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Mortgage intelligence command center" />

      <div className="px-6 py-6 space-y-6 max-w-[1600px]">
        {/* Quick Actions */}
        <section>
          <div className="text-hud text-[10px] text-muted-foreground mb-2">QUICK ACTIONS</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <QuickAction
              icon={Search}
              title="Start Loan Search"
              desc="Match borrower scenario to lender products"
              onClick={() => navigate({ to: "/loan-search" })}
            />
            <QuickAction
              icon={Calculator}
              title="Start Income Analysis"
              desc="Bank statement income calculator"
              onClick={quickCreateAnalysis}
              loading={creating}
            />
            <QuickAction
              icon={Upload}
              title="Upload Bank Statements"
              desc="New analysis with PDF upload"
              onClick={quickCreateAnalysis}
              loading={creating}
            />
            <QuickAction
              icon={UserPlus}
              title="Create Borrower File"
              desc="New borrower profile + workflow"
              onClick={quickCreateBorrower}
              loading={creating}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <RecentList
            title="Recent Borrower Files"
            icon={Users}
            href="/borrowers"
            items={borrowers}
            loading={loading}
            emptyMsg="No borrower files yet"
            renderItem={(b: BorrowerRow) => (
              <Link
                key={b.id}
                to={"/borrowers/$id" as never}
                params={{ id: b.id } as never}
                className="block rounded-sm border border-border bg-background/40 p-3 hover:border-cyan/60 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{b.borrower_name}</span>
                  <span className="text-hud text-[9px] text-cyan uppercase">{b.status}</span>
                </div>
                <div className="text-mono text-[10px] text-muted-foreground mt-1">
                  Updated {new Date(b.updated_at).toLocaleDateString()}
                </div>
              </Link>
            )}
          />

          <RecentList
            title="Recent Income Analyses"
            icon={Calculator}
            href="/income-analyzer"
            items={analyses}
            loading={loading}
            emptyMsg="No analyses yet"
            renderItem={(a: AnalysisRow) => (
              <Link
                key={a.id}
                to={"/income-analyzer/$id" as never}
                params={{ id: a.id } as never}
                className="block rounded-sm border border-border bg-background/40 p-3 hover:border-cyan/60 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{a.borrower_name}</span>
                  <span className="text-hud text-[9px] text-cyan uppercase">{a.status}</span>
                </div>
                <div className="text-mono text-[10px] text-muted-foreground mt-1">
                  {a.analysis_type}
                  {a.qualifying_monthly_income ? ` · $${Number(a.qualifying_monthly_income).toLocaleString()}/mo` : ""}
                </div>
              </Link>
            )}
          />

          <RecentList
            title="Recent Loan Searches"
            icon={Search}
            href="/loan-search"
            items={searches}
            loading={loading}
            emptyMsg="No searches yet"
            renderItem={(s: SearchRow) => (
              <div
                key={s.id}
                className="block rounded-sm border border-border bg-background/40 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{s.nickname || "Scenario"}</span>
                  <span className="text-hud text-[9px] text-cyan">{s.match_count ?? 0} matches</span>
                </div>
                <div className="text-mono text-[10px] text-muted-foreground mt-1 truncate">
                  {s.top_lender ? `${s.top_lender} — ${s.top_product}` : "No top match"}
                </div>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon, title, desc, onClick, loading,
}: { icon: typeof Search; title: string; desc: string; onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="hud-panel rounded-md p-4 text-left group hover:border-cyan/60 transition disabled:opacity-60"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-sm bg-cyan/10 border border-cyan/30 p-2">
          {loading ? (
            <Loader2 className="h-4 w-4 text-cyan animate-spin" />
          ) : (
            <Icon className="h-4 w-4 text-cyan" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-hud text-xs text-foreground">{title}</div>
          <div className="text-mono text-[10px] text-muted-foreground mt-0.5">{desc}</div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-cyan transition" />
      </div>
    </button>
  );
}

interface RecentListProps<T> {
  title: string;
  icon: typeof Clock;
  href: string;
  items: T[];
  loading: boolean;
  emptyMsg: string;
  renderItem: (item: T) => React.ReactNode;
}
function RecentList<T>({ title, icon: Icon, href, items, loading, emptyMsg, renderItem }: RecentListProps<T>) {
  return (
    <div className="hud-panel rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-cyan" />
          <span className="text-hud text-xs text-cyan">{title}</span>
        </div>
        <Link to={href as never} className="text-hud text-[10px] text-muted-foreground hover:text-cyan transition">
          VIEW ALL
        </Link>
      </div>
      {loading ? (
        <div className="text-mono text-xs text-muted-foreground">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-mono text-xs text-muted-foreground py-4 text-center">{emptyMsg}</div>
      ) : (
        <div className="space-y-2">{items.map(renderItem)}</div>
      )}
    </div>
  );
}
