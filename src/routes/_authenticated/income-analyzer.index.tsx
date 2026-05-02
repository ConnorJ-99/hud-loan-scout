import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/loaniq/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import { Plus, Calculator, Loader2, Trash2, Upload, X, ArrowRight, ArrowLeft, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/income-analyzer/")({
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

const inputCls = "w-full rounded-sm border border-input bg-background/60 px-2.5 py-1.5 text-sm text-mono outline-none focus:border-cyan transition";

function IncomeAnalyzerList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

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

  async function deleteAnalysis(e: React.MouseEvent, row: Row) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete analysis for "${row.borrower_name}"? This will also delete its statements and transactions.`)) return;
    await supabase.from("statement_transactions").delete().eq("income_analysis_id", row.id);
    await supabase.from("bank_statements").delete().eq("income_analysis_id", row.id);
    const { error } = await supabase.from("income_analyses").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Analysis deleted");
  }

  return (
    <div>
      <PageHeader
        title="Income Analyzer"
        subtitle="Bank statement income calculator"
        actions={
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-2 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20 transition"
          >
            <Plus className="h-3.5 w-3.5" />
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
              onClick={() => setWizardOpen(true)}
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
                  <th className="px-4 py-2.5"></th>
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
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={(e) => deleteAnalysis(e, r)}
                        className="text-muted-foreground hover:text-destructive transition"
                        title="Delete analysis"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {wizardOpen && user && (
        <NewAnalysisWizard
          userId={user.id}
          onClose={() => setWizardOpen(false)}
          onComplete={(id) => navigate({ to: "/income-analyzer/$id" as never, params: { id } as never })}
        />
      )}
    </div>
  );
}

type Step = 1 | 2 | 3 | 4;

function NewAnalysisWizard({
  userId,
  onClose,
  onComplete,
}: {
  userId: string;
  onClose: () => void;
  onComplete: (id: string) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [months, setMonths] = useState<12 | 24>(12);
  const [expenseFactor, setExpenseFactor] = useState(0.5);
  const [files, setFiles] = useState<File[]>([]);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<{
    id: string;
    qualifying: number;
    deposits: number;
    excluded: number;
    monthsReviewed: number;
  } | null>(null);

  function next() {
    if (step === 1 && !name.trim()) return toast.error("Enter a scenario name");
    if (step === 2 && files.length === 0) return toast.error("Upload at least one PDF");
    if (step < 4) setStep((step + 1) as Step);
  }
  function back() {
    if (step > 1) setStep((step - 1) as Step);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const pdfs = Array.from(list).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length !== list.length) toast.warning("Only PDF files were added");
    setFiles((prev) => [...prev, ...pdfs]);
  }

  async function runAnalysis() {
    setWorking(true);
    try {
      // 1. Create analysis row
      setProgress("Creating analysis…");
      const { data: aRow, error: aErr } = await supabase
        .from("income_analyses")
        .insert({
          created_by: userId,
          borrower_name: name.trim(),
          analysis_type: months === 24 ? "24-month bank statement" : "12-month bank statement",
          expense_factor: expenseFactor,
          status: "draft",
        })
        .select("id")
        .single();
      if (aErr || !aRow) throw new Error(aErr?.message ?? "Could not create analysis");
      const analysisId = aRow.id;

      // 2. Upload all PDFs
      const uploaded: { id: string; name: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`);
        const path = `${userId}/${analysisId}/${Date.now()}-${file.name}`;
        const up = await supabase.storage.from("bank-statements").upload(path, file);
        if (up.error) {
          toast.error(`Upload failed: ${file.name}`);
          continue;
        }
        const { data: row, error } = await supabase
          .from("bank_statements")
          .insert({
            created_by: userId,
            income_analysis_id: analysisId,
            file_path: path,
            file_name: file.name,
            parse_status: "uploaded",
          })
          .select("id")
          .single();
        if (error || !row) {
          toast.error(error?.message ?? "Insert failed");
          continue;
        }
        uploaded.push({ id: row.id, name: file.name });
      }
      if (uploaded.length === 0) throw new Error("No statements uploaded");

      // 3. Parse each statement sequentially
      for (let i = 0; i < uploaded.length; i++) {
        const s = uploaded[i];
        setProgress(`Parsing ${i + 1}/${uploaded.length}: ${s.name}`);
        const { data, error } = await supabase.functions.invoke("parse-bank-statement", {
          body: { statementId: s.id },
        });
        if (error || data?.error) {
          toast.error(`Parse failed (${s.name})`);
        }
      }

      // 4. Calculate
      setProgress("Calculating qualifying income…");
      const [tRes, sRes] = await Promise.all([
        supabase.from("statement_transactions").select("deposit_amount, included_in_income").eq("income_analysis_id", analysisId),
        supabase.from("bank_statements").select("parse_status").eq("income_analysis_id", analysisId),
      ]);
      const txns = (tRes.data ?? []) as { deposit_amount: number | null; included_in_income: boolean }[];
      const stmts = (sRes.data ?? []) as { parse_status: string }[];
      const totalDeposits = txns.reduce((s, t) => s + (Number(t.deposit_amount) || 0), 0);
      const qualifying = txns.filter((t) => t.included_in_income).reduce((s, t) => s + (Number(t.deposit_amount) || 0), 0);
      const excluded = totalDeposits - qualifying;
      const parsedCount = stmts.filter((s) => s.parse_status === "parsed").length;
      const monthsReviewed = parsedCount > 0 ? parsedCount : months;
      const avg = monthsReviewed > 0 ? qualifying / monthsReviewed : 0;
      const qualMonthly = avg * expenseFactor;

      await supabase.from("income_analyses").update({
        total_deposits: totalDeposits,
        excluded_deposits: excluded,
        qualifying_deposits: qualifying,
        avg_monthly_deposits: avg,
        qualifying_monthly_income: qualMonthly,
        months_reviewed: monthsReviewed,
        status: "calculated",
      }).eq("id", analysisId);

      setResult({
        id: analysisId,
        qualifying: qualMonthly,
        deposits: totalDeposits,
        excluded,
        monthsReviewed,
      });
      setStep(4);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setWorking(false);
      setProgress("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="hud-panel rounded-md w-full max-w-lg bg-background border border-cyan/40">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-hud text-xs text-cyan">NEW ANALYSIS · STEP {step} OF 4</div>
            <div className="text-mono text-[10px] text-muted-foreground mt-0.5">
              {step === 1 && "Scenario details"}
              {step === 2 && "Upload statements"}
              {step === 3 && "Auto-parsing"}
              {step === 4 && "Results"}
            </div>
          </div>
          {!working && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4 min-h-[280px]">
          {step === 1 && (
            <>
              <Field label="Scenario Name">
                <input autoFocus className={inputCls} placeholder="e.g. John Smith — Self Employed" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="How many months of statements?">
                <div className="grid grid-cols-2 gap-2">
                  {[12, 24].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMonths(m as 12 | 24)}
                      className={`rounded-sm border px-3 py-2 text-hud text-xs transition ${
                        months === m ? "border-cyan bg-cyan/10 text-cyan" : "border-border text-muted-foreground hover:border-cyan/50"
                      }`}
                    >
                      {m} MONTHS
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Expense Factor">
                <select className={inputCls} value={String(expenseFactor)} onChange={(e) => setExpenseFactor(Number(e.target.value))}>
                  <option value="1">100% — no expense haircut</option>
                  <option value="0.9">90% — 10% expenses</option>
                  <option value="0.75">75% — 25% expenses</option>
                  <option value="0.5">50% — 50% expenses</option>
                  <option value="0.4">40% — 60% expenses</option>
                  <option value="0.3">30% — 70% expenses</option>
                </select>
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <label className="block rounded-sm border-2 border-dashed border-cyan/40 bg-cyan/5 p-6 text-center cursor-pointer hover:bg-cyan/10 transition">
                <Upload className="h-6 w-6 text-cyan mx-auto mb-2" />
                <div className="text-hud text-xs text-cyan">CLICK TO UPLOAD PDFS</div>
                <div className="text-mono text-[10px] text-muted-foreground mt-1">{months} statements recommended</div>
                <input type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
              </label>
              {files.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-auto">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between rounded-sm border border-border bg-background/40 px-2.5 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-cyan shrink-0" />
                        <span className="text-mono text-xs truncate">{f.name}</span>
                      </div>
                      <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="text-mono text-[10px] text-muted-foreground pt-1">{files.length} file(s) ready</div>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 text-cyan animate-spin" />
              <div className="text-hud text-xs text-cyan">PROCESSING</div>
              <div className="text-mono text-xs text-muted-foreground text-center">{progress || "Working…"}</div>
              <div className="text-mono text-[10px] text-muted-foreground text-center max-w-xs">
                &gt; Uploading PDFs, extracting deposits, classifying transactions, and calculating qualifying income.
              </div>
            </div>
          )}

          {step === 4 && result && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-hud text-sm">ANALYSIS COMPLETE</span>
              </div>
              <div className="rounded-sm border border-border bg-background/40 p-4 space-y-2">
                <Row2 label="Qualifying Monthly Income" value={`$${result.qualifying.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} highlight />
                <Row2 label="Total Deposits" value={`$${result.deposits.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                <Row2 label="Excluded Deposits" value={`$${result.excluded.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                <Row2 label="Months Reviewed" value={String(result.monthsReviewed)} />
                <Row2 label="Expense Factor" value={`${Math.round(expenseFactor * 100)}%`} />
              </div>
              <p className="text-mono text-[10px] text-muted-foreground text-center">
                &gt; Open the full analysis to review deposits and include/exclude items.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <button
            onClick={back}
            disabled={step === 1 || working || step === 4}
            className="flex items-center gap-1.5 text-hud text-xs text-muted-foreground hover:text-cyan disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> BACK
          </button>
          {step === 1 && (
            <button onClick={next} className="flex items-center gap-1.5 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20">
              NEXT <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          {step === 2 && (
            <button onClick={() => { setStep(3); runAnalysis(); }} className="flex items-center gap-1.5 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20">
              START ANALYSIS <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          {step === 3 && (
            <span className="text-mono text-[10px] text-muted-foreground">Please wait…</span>
          )}
          {step === 4 && result && (
            <button
              onClick={() => onComplete(result.id)}
              className="flex items-center gap-1.5 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20"
            >
              REVIEW ANALYSIS <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-hud text-[10px] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function Row2({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-mono text-xs text-muted-foreground">{label}</span>
      <span className={`text-mono text-sm ${highlight ? "text-success font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
