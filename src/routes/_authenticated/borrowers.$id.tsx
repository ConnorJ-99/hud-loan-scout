import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/loaniq/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Loader2, Calculator, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/borrowers/$id")({
  head: () => ({ meta: [{ title: "Borrower File — LoanIQ" }] }),
  component: BorrowerDetail,
});

interface Borrower {
  id: string;
  borrower_name: string;
  email: string | null;
  phone: string | null;
  loan_officer: string | null;
  loan_purpose: string | null;
  target_program: string | null;
  property_address: string | null;
  purchase_price: number | null;
  loan_amount: number | null;
  status: string;
  notes: string | null;
}

const inputCls = "w-full rounded-sm border border-input bg-background/60 px-2.5 py-1.5 text-sm text-mono outline-none focus:border-cyan transition";

function BorrowerDetail() {
  const { id } = Route.useParams() as { id: string };
  const navigate = useNavigate();
  const [b, setB] = useState<Borrower | null>(null);
  const [analyses, setAnalyses] = useState<{ id: string; borrower_name: string; analysis_type: string; status: string; qualifying_monthly_income: number | null; updated_at: string }[]>([]);
  const [searches, setSearches] = useState<{ id: string; nickname: string | null; top_lender: string | null; top_product: string | null; match_count: number | null; created_at: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    supabase.from("borrower_files").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error || !data) {
        toast.error("Borrower not found");
        navigate({ to: "/borrowers" });
        return;
      }
      setB(data as Borrower);
    });
    supabase.from("income_analyses").select("id, borrower_name, analysis_type, status, qualifying_monthly_income, updated_at")
      .eq("borrower_file_id", id).order("updated_at", { ascending: false })
      .then(({ data }) => setAnalyses((data ?? []) as typeof analyses));
    supabase.from("loan_searches").select("id, nickname, top_lender, top_product, match_count, created_at")
      .eq("borrower_file_id", id).order("created_at", { ascending: false })
      .then(({ data }) => setSearches((data ?? []) as typeof searches));
  }, [id, navigate]);

  useEffect(load, [load]);

  async function save() {
    if (!b) return;
    setSaving(true);
    const { id: _id, ...patch } = b;
    void _id;
    const { error } = await supabase.from("borrower_files").update(patch).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }

  if (!b) return <div className="p-6 text-mono text-sm text-muted-foreground">Loading...</div>;

  return (
    <div>
      <PageHeader
        title={b.borrower_name || "Borrower"}
        subtitle={b.loan_purpose ?? "Borrower file"}
        actions={
          <>
            <button onClick={() => navigate({ to: "/borrowers" })} className="flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 text-hud text-xs text-muted-foreground hover:text-cyan transition">
              <ArrowLeft className="h-3.5 w-3.5" /> BACK
            </button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20 transition disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} SAVE
            </button>
          </>
        }
      />
      <div className="px-6 py-6 max-w-[1100px] space-y-5">
        <section className="hud-panel rounded-md p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Borrower Name"><input className={inputCls} value={b.borrower_name} onChange={(e) => setB({ ...b, borrower_name: e.target.value })} /></Field>
          <Field label="Loan Officer"><input className={inputCls} value={b.loan_officer ?? ""} onChange={(e) => setB({ ...b, loan_officer: e.target.value })} /></Field>
          <Field label="Email"><input className={inputCls} value={b.email ?? ""} onChange={(e) => setB({ ...b, email: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputCls} value={b.phone ?? ""} onChange={(e) => setB({ ...b, phone: e.target.value })} /></Field>
          <Field label="Loan Purpose">
            <select className={inputCls} value={b.loan_purpose ?? ""} onChange={(e) => setB({ ...b, loan_purpose: e.target.value })}>
              <option value="">—</option>
              <option>Purchase</option>
              <option>Refinance</option>
              <option>Cash-Out Refi</option>
            </select>
          </Field>
          <Field label="Target Program"><input className={inputCls} value={b.target_program ?? ""} onChange={(e) => setB({ ...b, target_program: e.target.value })} /></Field>
          <Field label="Property Address"><input className={inputCls} value={b.property_address ?? ""} onChange={(e) => setB({ ...b, property_address: e.target.value })} /></Field>
          <Field label="Status">
            <select className={inputCls} value={b.status} onChange={(e) => setB({ ...b, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="closed">Closed</option>
              <option value="declined">Declined</option>
            </select>
          </Field>
          <Field label="Purchase Price $"><input type="number" className={inputCls} value={b.purchase_price ?? ""} onChange={(e) => setB({ ...b, purchase_price: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Loan Amount $"><input type="number" className={inputCls} value={b.loan_amount ?? ""} onChange={(e) => setB({ ...b, loan_amount: e.target.value ? Number(e.target.value) : null })} /></Field>
        </section>
        <section className="hud-panel rounded-md p-4">
          <div className="text-hud text-[10px] text-muted-foreground mb-1">NOTES</div>
          <textarea rows={5} className={inputCls} value={b.notes ?? ""} onChange={(e) => setB({ ...b, notes: e.target.value })} />
        </section>

        <section className="hud-panel rounded-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-4 w-4 text-cyan" />
            <span className="text-hud text-xs text-cyan">LINKED INCOME ANALYSES ({analyses.length})</span>
          </div>
          {analyses.length === 0 ? (
            <p className="text-mono text-xs text-muted-foreground py-3 text-center">&gt; No analyses linked. Open Income Analyzer and link this borrower file.</p>
          ) : (
            <div className="space-y-1.5">
              {analyses.map((a) => (
                <Link key={a.id} to={"/income-analyzer/$id" as never} params={{ id: a.id } as never}
                  className="flex items-center justify-between rounded-sm border border-border bg-background/40 p-2.5 hover:border-cyan/60 transition">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{a.analysis_type}</div>
                    <div className="text-mono text-[10px] text-muted-foreground">
                      {a.status}{a.qualifying_monthly_income ? ` · $${Number(a.qualifying_monthly_income).toLocaleString()}/mo` : ""}
                    </div>
                  </div>
                  <div className="text-mono text-[10px] text-muted-foreground">{new Date(a.updated_at).toLocaleDateString()}</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="hud-panel rounded-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-cyan" />
            <span className="text-hud text-xs text-cyan">LINKED LOAN SEARCHES ({searches.length})</span>
          </div>
          {searches.length === 0 ? (
            <p className="text-mono text-xs text-muted-foreground py-3 text-center">&gt; No loan searches linked.</p>
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
                  <div className="text-mono text-[10px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-hud text-[10px] text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
