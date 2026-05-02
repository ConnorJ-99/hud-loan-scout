import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/loaniq/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2, Save, Loader2, FileText, Calculator } from "lucide-react";

export const Route = createFileRoute("/_authenticated/income-analyzer/$id")({
  head: () => ({ meta: [{ title: "Income Analysis — LoanIQ" }] }),
  component: AnalysisDetail,
});

type AnalysisType = "12-month bank statement" | "24-month bank statement" | "Business bank statements" | "Personal bank statements";

interface Analysis {
  id: string;
  borrower_name: string;
  borrower_file_id: string | null;
  analysis_type: string;
  statement_period_start: string | null;
  statement_period_end: string | null;
  months_reviewed: number | null;
  total_deposits: number | null;
  excluded_deposits: number | null;
  qualifying_deposits: number | null;
  avg_monthly_deposits: number | null;
  expense_factor: number;
  qualifying_monthly_income: number | null;
  status: string;
  reviewer_notes: string | null;
  large_deposit_threshold: number | null;
}

interface BorrowerOption { id: string; borrower_name: string }

interface Statement {
  id: string;
  file_name: string | null;
  bank_name: string | null;
  account_last4: string | null;
  period_start: string | null;
  period_end: string | null;
  parse_status: string;
  file_path: string | null;
}

interface Txn {
  id: string;
  txn_date: string | null;
  description: string | null;
  deposit_amount: number | null;
  classification: string;
  included_in_income: boolean;
  reason: string | null;
  manual_override: boolean;
}

const CLASSIFICATIONS = [
  "Business revenue",
  "Payroll / W-2 income",
  "Transfers",
  "Refunds",
  "Zelle / Venmo / Cash App",
  "Loan proceeds",
  "Non-recurring deposits",
  "Duplicate deposits",
  "Unclear / needs review",
];

const inputCls = "w-full rounded-sm border border-input bg-background/60 px-2.5 py-1.5 text-sm text-mono outline-none focus:border-cyan transition";

function AnalysisDetail() {
  const { id } = Route.useParams() as { id: string };
  const { user } = useAuth();
  const navigate = useNavigate();
  const [a, setA] = useState<Analysis | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const [aRes, sRes, tRes] = await Promise.all([
      supabase.from("income_analyses").select("*").eq("id", id).maybeSingle(),
      supabase.from("bank_statements").select("id, file_name, bank_name, account_last4, period_start, period_end, parse_status, file_path").eq("income_analysis_id", id).order("created_at"),
      supabase.from("statement_transactions").select("id, txn_date, description, deposit_amount, classification, included_in_income, reason, manual_override").eq("income_analysis_id", id).order("txn_date"),
    ]);
    if (aRes.error || !aRes.data) {
      toast.error("Analysis not found");
      navigate({ to: "/income-analyzer" });
      return;
    }
    setA(aRes.data as Analysis);
    setStatements((sRes.data ?? []) as Statement[]);
    setTxns((tRes.data ?? []) as Txn[]);
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!a) return;
    setSaving(true);
    const { error } = await supabase
      .from("income_analyses")
      .update({
        borrower_name: a.borrower_name,
        analysis_type: a.analysis_type,
        statement_period_start: a.statement_period_start,
        statement_period_end: a.statement_period_end,
        expense_factor: a.expense_factor,
        large_deposit_threshold: a.large_deposit_threshold,
        reviewer_notes: a.reviewer_notes,
        status: a.status,
      })
      .eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }

  async function uploadFiles(files: FileList) {
    if (!user || !a) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const path = `${user.id}/${id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("bank-statements").upload(path, file);
      if (up.error) {
        toast.error(`Upload failed: ${up.error.message}`);
        continue;
      }
      const { error } = await supabase.from("bank_statements").insert({
        created_by: user.id,
        income_analysis_id: id,
        file_path: path,
        file_name: file.name,
        parse_status: "uploaded",
      });
      if (error) toast.error(error.message);
    }
    setUploading(false);
    toast.success("Statements uploaded. Parse with AI from the statement row.");
    load();
  }

  async function parseStatement(stmt: Statement) {
    if (!stmt.file_path) {
      toast.error("No file path");
      return;
    }
    // Mark UI as parsing immediately
    setStatements((prev) => prev.map((s) => s.id === stmt.id ? { ...s, parse_status: "parsing" } : s));
    toast.info(`Parsing ${stmt.file_name}…`);
    const { data, error } = await supabase.functions.invoke("parse-bank-statement", {
      body: { statementId: stmt.id },
    });
    if (error || data?.error) {
      const msg = data?.error ?? error?.message ?? "Parse failed";
      toast.error(`Parse failed: ${msg}`);
      load();
      return;
    }
    toast.success(`Parsed ${data.deposits_extracted} deposits (${data.deposits_included} included)`);
    load();
  }

  async function deleteStatement(stmtId: string) {
    if (!confirm("Delete this statement and its transactions?")) return;
    const { error } = await supabase.from("bank_statements").delete().eq("id", stmtId);
    if (error) return toast.error(error.message);
    load();
  }

  async function addTxn() {
    if (!user || statements.length === 0) {
      toast.error("Upload a statement first");
      return;
    }
    const { error } = await supabase.from("statement_transactions").insert({
      created_by: user.id,
      income_analysis_id: id,
      bank_statement_id: statements[0].id,
      txn_date: new Date().toISOString().slice(0, 10),
      description: "",
      deposit_amount: 0,
      classification: "Unclear / needs review",
      included_in_income: false,
    });
    if (error) return toast.error(error.message);
    load();
  }

  async function updateTxn(txnId: string, patch: Partial<Txn>) {
    const { error } = await supabase.from("statement_transactions").update({
      ...patch,
      manual_override: true,
    }).eq("id", txnId);
    if (error) return toast.error(error.message);
    setTxns((prev) => prev.map((t) => (t.id === txnId ? { ...t, ...patch, manual_override: true } : t)));
  }

  async function deleteTxn(txnId: string) {
    const { error } = await supabase.from("statement_transactions").delete().eq("id", txnId);
    if (error) return toast.error(error.message);
    setTxns((prev) => prev.filter((t) => t.id !== txnId));
  }

  async function calculate() {
    if (!a) return;
    const totalDeposits = txns.reduce((sum, t) => sum + (Number(t.deposit_amount) || 0), 0);
    const qualifying = txns.filter((t) => t.included_in_income).reduce((sum, t) => sum + (Number(t.deposit_amount) || 0), 0);
    const excluded = totalDeposits - qualifying;
    const months = a.months_reviewed ?? (a.analysis_type.startsWith("24") ? 24 : 12);
    const avg = months > 0 ? qualifying / months : 0;
    const qualMonthly = avg * Number(a.expense_factor);

    const { error } = await supabase.from("income_analyses").update({
      total_deposits: totalDeposits,
      excluded_deposits: excluded,
      qualifying_deposits: qualifying,
      avg_monthly_deposits: avg,
      qualifying_monthly_income: qualMonthly,
      months_reviewed: months,
      status: "calculated",
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Income calculated");
    load();
  }

  if (!a) return <div className="p-6 text-mono text-sm text-muted-foreground">Loading...</div>;

  return (
    <div>
      <PageHeader
        title={a.borrower_name || "Income Analysis"}
        subtitle={a.analysis_type}
        actions={
          <>
            <button onClick={() => navigate({ to: "/income-analyzer" })} className="flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 text-hud text-xs text-muted-foreground hover:text-cyan transition">
              <ArrowLeft className="h-3.5 w-3.5" /> BACK
            </button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20 transition disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} SAVE
            </button>
          </>
        }
      />
      <div className="px-6 py-6 space-y-5 max-w-[1400px]">
        {/* Borrower + Settings */}
        <section className="hud-panel rounded-md p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Borrower Name">
            <input className={inputCls} value={a.borrower_name} onChange={(e) => setA({ ...a, borrower_name: e.target.value })} />
          </Field>
          <Field label="Analysis Type">
            <select className={inputCls} value={a.analysis_type} onChange={(e) => setA({ ...a, analysis_type: e.target.value as AnalysisType })}>
              <option>12-month bank statement</option>
              <option>24-month bank statement</option>
              <option>Business bank statements</option>
              <option>Personal bank statements</option>
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={a.status} onChange={(e) => setA({ ...a, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="in_review">In Review</option>
              <option value="calculated">Calculated</option>
              <option value="finalized">Finalized</option>
            </select>
          </Field>
          <Field label="Period Start">
            <input type="date" className={inputCls} value={a.statement_period_start ?? ""} onChange={(e) => setA({ ...a, statement_period_start: e.target.value })} />
          </Field>
          <Field label="Period End">
            <input type="date" className={inputCls} value={a.statement_period_end ?? ""} onChange={(e) => setA({ ...a, statement_period_end: e.target.value })} />
          </Field>
          <Field label="Expense Factor">
            <select className={inputCls} value={String(a.expense_factor)} onChange={(e) => setA({ ...a, expense_factor: Number(e.target.value) })}>
              <option value="0.5">50%</option>
              <option value="0.6">60%</option>
              <option value="0.7">70%</option>
              <option value="1">100% (custom)</option>
            </select>
          </Field>
        </section>

        {/* Statements */}
        <section className="hud-panel rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan" />
              <span className="text-hud text-xs text-cyan">BANK STATEMENTS</span>
            </div>
            <label className={`flex items-center gap-2 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20 transition cursor-pointer ${uploading ? "opacity-50" : ""}`}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} UPLOAD PDFS
              <input type="file" accept="application/pdf" multiple className="hidden" disabled={uploading}
                onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
            </label>
          </div>
          {statements.length === 0 ? (
            <p className="text-mono text-xs text-muted-foreground py-4 text-center">&gt; No statements uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {statements.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-sm border border-border bg-background/40 p-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{s.file_name}</div>
                    <div className="text-mono text-[10px] text-muted-foreground">
                      {s.bank_name ?? "Unparsed"} · {s.account_last4 ? `*${s.account_last4}` : ""} · {s.parse_status}
                    </div>
                  </div>
                  <button onClick={() => parseStatement(s)} className="text-hud text-[10px] text-cyan border border-cyan/40 rounded-sm px-2 py-1 hover:bg-cyan/10">PARSE</button>
                  <button onClick={() => deleteStatement(s.id)} className="ml-2 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Transactions */}
        <section className="hud-panel rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-hud text-xs text-cyan">TRANSACTIONS ({txns.length})</span>
            <div className="flex items-center gap-2">
              <button onClick={addTxn} className="text-hud text-[10px] text-muted-foreground border border-border rounded-sm px-2 py-1 hover:text-cyan hover:border-cyan/60">+ ADD</button>
              <button onClick={calculate} className="flex items-center gap-1.5 rounded-sm border border-success/60 bg-success/10 px-3 py-1 text-hud text-[10px] text-success hover:bg-success/20">
                <Calculator className="h-3 w-3" /> CALCULATE INCOME
              </button>
            </div>
          </div>
          {txns.length === 0 ? (
            <p className="text-mono text-xs text-muted-foreground py-4 text-center">&gt; Upload statements then add or extract transactions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 text-hud text-[9px] text-muted-foreground">DATE</th>
                    <th className="text-left py-1.5 text-hud text-[9px] text-muted-foreground">DESCRIPTION</th>
                    <th className="text-right py-1.5 text-hud text-[9px] text-muted-foreground">DEPOSIT</th>
                    <th className="text-left py-1.5 text-hud text-[9px] text-muted-foreground">CLASSIFICATION</th>
                    <th className="text-center py-1.5 text-hud text-[9px] text-muted-foreground">INCLUDE</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-b-0">
                      <td className="py-1">
                        <input type="date" value={t.txn_date ?? ""} onChange={(e) => updateTxn(t.id, { txn_date: e.target.value })}
                          className="bg-transparent border border-transparent hover:border-border focus:border-cyan rounded-sm px-1 py-0.5 text-mono w-32" />
                      </td>
                      <td className="py-1">
                        <input value={t.description ?? ""} onChange={(e) => updateTxn(t.id, { description: e.target.value })}
                          className="bg-transparent border border-transparent hover:border-border focus:border-cyan rounded-sm px-1 py-0.5 w-full" />
                      </td>
                      <td className="py-1 text-right">
                        <input type="number" value={t.deposit_amount ?? 0} onChange={(e) => updateTxn(t.id, { deposit_amount: Number(e.target.value) })}
                          className="bg-transparent border border-transparent hover:border-border focus:border-cyan rounded-sm px-1 py-0.5 text-mono text-right w-24" />
                      </td>
                      <td className="py-1">
                        <select value={t.classification} onChange={(e) => updateTxn(t.id, { classification: e.target.value })}
                          className="bg-background/60 border border-border rounded-sm px-1 py-0.5 text-mono text-[11px]">
                          {CLASSIFICATIONS.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="py-1 text-center">
                        <input type="checkbox" checked={t.included_in_income} onChange={(e) => updateTxn(t.id, { included_in_income: e.target.checked })} className="accent-cyan" />
                      </td>
                      <td className="py-1 text-right">
                        <button onClick={() => deleteTxn(t.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Results */}
        <section className="hud-panel rounded-md p-4">
          <span className="text-hud text-xs text-cyan">QUALIFYING INCOME REPORT</span>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-mono text-sm">
            <Stat label="Total Deposits" value={a.total_deposits} />
            <Stat label="Excluded" value={a.excluded_deposits} />
            <Stat label="Qualifying" value={a.qualifying_deposits} />
            <Stat label="Avg Monthly" value={a.avg_monthly_deposits} />
            <Stat label="Months" value={a.months_reviewed} raw />
            <Stat label="Expense Factor" value={Math.round(Number(a.expense_factor) * 100)} suffix="%" raw />
            <div className="col-span-2 rounded-sm border border-success/60 bg-success/10 p-3">
              <div className="text-hud text-[10px] text-muted-foreground">FINAL QUALIFYING MONTHLY INCOME</div>
              <div className="text-display text-2xl text-success glow-success mt-1">
                ${a.qualifying_monthly_income ? Number(a.qualifying_monthly_income).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-hud text-[10px] text-muted-foreground mb-1">REVIEWER NOTES</div>
            <textarea
              value={a.reviewer_notes ?? ""}
              onChange={(e) => setA({ ...a, reviewer_notes: e.target.value })}
              rows={3}
              className={inputCls}
              placeholder="Notes for the file..."
            />
          </div>
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

function Stat({ label, value, suffix, raw }: { label: string; value: number | null; suffix?: string; raw?: boolean }) {
  return (
    <div className="rounded-sm border border-border bg-background/40 p-2.5">
      <div className="text-hud text-[10px] text-muted-foreground">{label}</div>
      <div className="text-mono text-base mt-0.5">
        {value == null ? "—" : raw ? `${value}${suffix ?? ""}` : `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
      </div>
    </div>
  );
}
