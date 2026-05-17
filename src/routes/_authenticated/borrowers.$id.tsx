import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/loaniq/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";
import {
  ArrowLeft, Save, Loader2, Calculator, Search, UserCheck, Sparkles,
  AlertTriangle, FileText, CheckCircle2, Lightbulb, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { loadCatalogFromDb } from "@/lib/loaniq/dbCatalog";
import {
  generateSuggestions,
  buildDiscoveryQuestions,
  type Suggestion,
  type SuggestionPriority,
  type SuggestionCategory,
  type DiscoveryQuestion,
} from "@/lib/loaniq/suggestions";
import { polishPrequalNarrative } from "@/lib/loaniq/ai";
import type { BorrowerScenario, LenderProduct, Lender } from "@/lib/loaniq/types";
import { ScenarioForm } from "@/components/loaniq/ScenarioForm";

export const Route = createFileRoute("/_authenticated/borrowers/$id")({
  head: () => ({ meta: [{ title: "Borrower Prequal Profile — LoanIQ" }] }),
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
  assigned_lo_user_id: string | null;
  assigned_lo_name: string | null;
  assigned_lo_email: string | null;
  assigned_lo_nmls: string | null;
  prequal_scenario: BorrowerScenario | null;
  discovery_answers: Record<string, string | number | boolean> | null;
  suggestions: { suggestions: Suggestion[]; context: unknown } | null;
  suggestions_narrative: string | null;
  suggestions_updated_at: string | null;
}

interface LoanOfficer {
  user_id: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  nmls: string | null;
}

const inputCls = "w-full rounded-sm border border-input bg-background/60 px-2.5 py-1.5 text-sm text-mono outline-none focus:border-cyan transition";

const PRIORITY_STYLES: Record<SuggestionPriority, string> = {
  Critical: "border-destructive/60 bg-destructive/5 text-destructive",
  High: "border-warn/60 bg-warn/5 text-warn",
  Medium: "border-cyan/60 bg-cyan/5 text-cyan",
  Low: "border-border bg-background/40 text-muted-foreground",
};

const CATEGORY_ICONS: Record<SuggestionCategory, React.ComponentType<{ className?: string }>> = {
  Opportunity: Lightbulb,
  Risk: AlertTriangle,
  "Guideline Warning": ShieldAlert,
  "Possible Solution": CheckCircle2,
  "Documentation Needed": FileText,
};

function BorrowerDetail() {
  const { id } = Route.useParams() as { id: string };
  const navigate = useNavigate();
  const { user } = useAuth();
  const [b, setB] = useState<Borrower | null>(null);
  const [analyses, setAnalyses] = useState<{ id: string; borrower_name: string; analysis_type: string; status: string; qualifying_monthly_income: number | null; updated_at: string }[]>([]);
  const [searches, setSearches] = useState<{ id: string; nickname: string | null; top_lender: string | null; top_product: string | null; match_count: number | null; created_at: string }[]>([]);
  const [los, setLos] = useState<LoanOfficer[]>([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"profile" | "prequal" | "discovery" | "suggestions">("profile");
  const [catalog, setCatalog] = useState<{ lenders: Lender[]; products: LenderProduct[] }>({ lenders: [], products: [] });

  const load = useCallback(() => {
    supabase.from("borrower_files").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error || !data) {
        toast.error("Borrower not found");
        navigate({ to: "/borrowers" });
        return;
      }
      setB(data as unknown as Borrower);
    });
    supabase.from("income_analyses").select("id, borrower_name, analysis_type, status, qualifying_monthly_income, updated_at")
      .eq("borrower_file_id", id).order("updated_at", { ascending: false })
      .then(({ data }) => setAnalyses((data ?? []) as typeof analyses));
    supabase.from("loan_searches").select("id, nickname, top_lender, top_product, match_count, created_at")
      .eq("borrower_file_id", id).order("created_at", { ascending: false })
      .then(({ data }) => setSearches((data ?? []) as typeof searches));
  }, [id, navigate]);

  useEffect(load, [load]);

  // Load loan officers: any profile that has an admin or loan_officer role
  useEffect(() => {
    (async () => {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["loan_officer", "admin"]);
      const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
      if (ids.length === 0) {
        // fallback: all profiles (small teams)
        const { data: all } = await supabase
          .from("profiles")
          .select("user_id, full_name, display_name, email, nmls");
        setLos((all ?? []) as LoanOfficer[]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, display_name, email, nmls")
        .in("user_id", ids);
      setLos((profs ?? []) as LoanOfficer[]);
    })();
  }, []);

  // Load lender catalog once (used by suggestion engine + AI polish)
  useEffect(() => {
    loadCatalogFromDb().then(setCatalog).catch(() => { /* silent — suggestions still work without catalog */ });
  }, []);

  const setBorrower = useCallback((patch: Partial<Borrower>) => {
    setB((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  async function save() {
    if (!b) return;
    setSaving(true);
    const { id: _id, ...patch } = b;
    void _id;
    const { error } = await supabase.from("borrower_files").update(patch as never).eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }

  const discoveryQuestions: DiscoveryQuestion[] = useMemo(
    () => (b?.prequal_scenario ? buildDiscoveryQuestions(b.prequal_scenario) : []),
    [b?.prequal_scenario],
  );

  const runSuggestions = useCallback(async () => {
    if (!b?.prequal_scenario) {
      toast.error("Fill the prequal scenario first");
      setTab("prequal");
      return;
    }
    setRunning(true);
    try {
      const answers = b.discovery_answers ?? {};
      const assets = Number(answers.assets ?? 0) || undefined;
      const reservesMonths = Number(answers.reserves_months ?? 0) || undefined;
      const { suggestions, context } = generateSuggestions(
        b.prequal_scenario,
        catalog.products,
        { assets, reservesMonths },
      );
      let narrative = "";
      try {
        narrative = await polishPrequalNarrative(
          b.prequal_scenario,
          { suggestions, context, discovery: answers },
          catalog,
        );
      } catch (e) {
        toast.warning(`AI polish failed — rules-engine output saved. ${e instanceof Error ? e.message : ""}`);
      }
      const payload = {
        suggestions: { suggestions, context } as never,
        suggestions_narrative: narrative,
        suggestions_updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("borrower_files")
        .update(payload as never)
        .eq("id", id);
      if (error) throw error;
      setBorrower(payload as unknown as Partial<Borrower>);
      toast.success(`${suggestions.length} suggestion(s) generated`);
      setTab("suggestions");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate suggestions");
    } finally {
      setRunning(false);
    }
  }, [b, catalog, id, setBorrower]);

  if (!b) return <div className="p-6 text-mono text-sm text-muted-foreground">Loading...</div>;

  return (
    <div>
      <PageHeader
        title={b.borrower_name || "Borrower"}
        subtitle={`${b.loan_purpose ?? "Borrower file"}${b.assigned_lo_name ? ` · LO: ${b.assigned_lo_name}` : ""}`}
        actions={
          <>
            <button onClick={() => navigate({ to: "/borrowers" })} className="flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 text-hud text-xs text-muted-foreground hover:text-cyan transition">
              <ArrowLeft className="h-3.5 w-3.5" /> BACK
            </button>
            <button onClick={runSuggestions} disabled={running} className="flex items-center gap-2 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20 transition disabled:opacity-50">
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} RUN SUGGESTIONS
            </button>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20 transition disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} SAVE
            </button>
          </>
        }
      />

      <div className="px-6 pt-3 max-w-[1100px]">
        <div className="flex gap-1 border-b border-border">
          {[
            { id: "profile" as const, label: "Profile" },
            { id: "prequal" as const, label: "Prequal Scenario" },
            { id: "discovery" as const, label: `Discovery${discoveryQuestions.length ? ` (${discoveryQuestions.length})` : ""}` },
            { id: "suggestions" as const, label: `Suggestions${b.suggestions?.suggestions?.length ? ` (${b.suggestions.suggestions.length})` : ""}` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-hud text-xs transition border-b-2 -mb-px ${
                tab === t.id ? "border-cyan text-cyan" : "border-transparent text-muted-foreground hover:text-cyan/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 max-w-[1100px] space-y-5">
        {tab === "profile" && (
          <>
            {/* Assigned LO panel */}
            <section className="hud-panel rounded-md p-4">
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="h-4 w-4 text-cyan" />
                <span className="text-hud text-xs text-cyan">ASSIGNED LOAN OFFICER</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Loan Officer">
                  <select
                    className={inputCls}
                    value={b.assigned_lo_user_id ?? ""}
                    onChange={(e) => {
                      const userId = e.target.value || null;
                      const lo = los.find((l) => l.user_id === userId);
                      setBorrower({
                        assigned_lo_user_id: userId,
                        assigned_lo_name: lo ? (lo.full_name || lo.display_name || lo.email) : null,
                        assigned_lo_email: lo?.email ?? null,
                        assigned_lo_nmls: lo?.nmls ?? null,
                        loan_officer: lo ? (lo.full_name || lo.display_name || lo.email) : null,
                      });
                    }}
                  >
                    <option value="">— Unassigned —</option>
                    {los.map((lo) => (
                      <option key={lo.user_id} value={lo.user_id}>
                        {(lo.full_name || lo.display_name || lo.email) ?? lo.user_id.slice(0, 8)}
                        {lo.nmls ? ` · NMLS ${lo.nmls}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="LO Email">
                  <input className={inputCls} value={b.assigned_lo_email ?? ""} readOnly />
                </Field>
                <Field label="LO NMLS">
                  <input className={inputCls} value={b.assigned_lo_nmls ?? ""} onChange={(e) => setBorrower({ assigned_lo_nmls: e.target.value })} />
                </Field>
                <Field label="Created by (signed-in user)">
                  <input className={inputCls} value={user?.email ?? ""} readOnly />
                </Field>
              </div>
              <p className="text-mono text-[10px] text-muted-foreground mt-2">
                &gt; Signed-in user and assigned LO are tracked separately — useful for assistants, processors, ISA, and concierge staff.
              </p>
            </section>

            <section className="hud-panel rounded-md p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Borrower Name"><input className={inputCls} value={b.borrower_name} onChange={(e) => setBorrower({ borrower_name: e.target.value })} /></Field>
              <Field label="Email"><input className={inputCls} value={b.email ?? ""} onChange={(e) => setBorrower({ email: e.target.value })} /></Field>
              <Field label="Phone"><input className={inputCls} value={b.phone ?? ""} onChange={(e) => setBorrower({ phone: e.target.value })} /></Field>
              <Field label="Loan Purpose">
                <select className={inputCls} value={b.loan_purpose ?? ""} onChange={(e) => setBorrower({ loan_purpose: e.target.value })}>
                  <option value="">—</option>
                  <option>Purchase</option>
                  <option>Refinance</option>
                  <option>Cash-Out Refi</option>
                </select>
              </Field>
              <Field label="Target Program"><input className={inputCls} value={b.target_program ?? ""} onChange={(e) => setBorrower({ target_program: e.target.value })} /></Field>
              <Field label="Property Address"><input className={inputCls} value={b.property_address ?? ""} onChange={(e) => setBorrower({ property_address: e.target.value })} /></Field>
              <Field label="Status">
                <select className={inputCls} value={b.status} onChange={(e) => setBorrower({ status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="prospect">Prospect</option>
                  <option value="closed">Closed</option>
                  <option value="declined">Declined</option>
                </select>
              </Field>
              <Field label="Purchase Price $"><input type="number" className={inputCls} value={b.purchase_price ?? ""} onChange={(e) => setBorrower({ purchase_price: e.target.value ? Number(e.target.value) : null })} /></Field>
              <Field label="Loan Amount $"><input type="number" className={inputCls} value={b.loan_amount ?? ""} onChange={(e) => setBorrower({ loan_amount: e.target.value ? Number(e.target.value) : null })} /></Field>
            </section>

            <section className="hud-panel rounded-md p-4">
              <div className="text-hud text-[10px] text-muted-foreground mb-1">NOTES</div>
              <textarea rows={5} className={inputCls} value={b.notes ?? ""} onChange={(e) => setBorrower({ notes: e.target.value })} />
            </section>

            <section className="hud-panel rounded-md p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-4 w-4 text-cyan" />
                <span className="text-hud text-xs text-cyan">LINKED INCOME ANALYSES ({analyses.length})</span>
              </div>
              {analyses.length === 0 ? (
                <p className="text-mono text-xs text-muted-foreground py-3 text-center">&gt; No analyses linked.</p>
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
          </>
        )}

        {tab === "prequal" && (
          <section>
            <ScenarioForm
              initial={b.prequal_scenario ?? undefined}
              scanning={false}
              onScan={(scn) => {
                setBorrower({ prequal_scenario: scn });
                toast.success("Scenario captured — click SAVE then RUN SUGGESTIONS");
              }}
            />
            <p className="text-mono text-[10px] text-muted-foreground mt-2 px-1">
              &gt; Capture the borrower's full prequal scenario. The button label says "SCAN" but on this page it just stages the scenario into the file — remember to SAVE.
            </p>
          </section>
        )}

        {tab === "discovery" && (
          <section className="hud-panel rounded-md p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-cyan" />
              <span className="text-hud text-xs text-cyan">GUIDED DISCOVERY</span>
            </div>
            {!b.prequal_scenario ? (
              <p className="text-mono text-xs text-muted-foreground">&gt; Fill the Prequal Scenario tab first — questions adapt to the borrower's profile.</p>
            ) : discoveryQuestions.length === 0 ? (
              <p className="text-mono text-xs text-muted-foreground">&gt; No dynamic questions for this profile yet.</p>
            ) : (
              groupBy(discoveryQuestions, (q) => q.group).map(([group, items]) => (
                <div key={group}>
                  <div className="text-hud text-[10px] text-cyan mb-2 mt-3">{group.toUpperCase()}</div>
                  <div className="space-y-2">
                    {items.map((q) => (
                      <DiscoveryAnswer
                        key={q.id}
                        q={q}
                        value={(b.discovery_answers ?? {})[q.id]}
                        onChange={(v) =>
                          setBorrower({
                            discovery_answers: { ...(b.discovery_answers ?? {}), [q.id]: v },
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {tab === "suggestions" && (
          <section className="space-y-4">
            {!b.suggestions?.suggestions?.length && !b.suggestions_narrative ? (
              <div className="hud-panel rounded-md p-12 text-center">
                <Sparkles className="h-10 w-10 text-cyan mx-auto mb-3" />
                <div className="text-hud text-cyan mb-1">NO SUGGESTIONS YET</div>
                <p className="text-mono text-xs text-muted-foreground mb-3">&gt; Capture the prequal scenario, then click RUN SUGGESTIONS in the header.</p>
                <button onClick={runSuggestions} disabled={running} className="inline-flex items-center gap-2 rounded-sm border border-cyan bg-cyan/10 px-3 py-1.5 text-hud text-xs text-cyan hover:bg-cyan/20 transition disabled:opacity-50">
                  {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} RUN NOW
                </button>
              </div>
            ) : (
              <>
                {b.suggestions_narrative && (
                  <section className="hud-panel rounded-md p-4">
                    <div className="text-hud text-xs text-cyan mb-2">LO / UNDERWRITER NARRATIVE</div>
                    <div className="prose prose-sm prose-invert max-w-none text-sm whitespace-pre-wrap">
                      {b.suggestions_narrative}
                    </div>
                    {b.suggestions_updated_at && (
                      <div className="text-mono text-[10px] text-muted-foreground mt-3">
                        Generated {new Date(b.suggestions_updated_at).toLocaleString()}
                      </div>
                    )}
                  </section>
                )}
                <section className="hud-panel rounded-md p-4 space-y-3">
                  <div className="text-hud text-xs text-cyan mb-1">STRUCTURED FINDINGS</div>
                  {(b.suggestions?.suggestions ?? []).map((s) => {
                    const Icon = CATEGORY_ICONS[s.category];
                    return (
                      <div key={s.id} className={`rounded-sm border p-3 ${PRIORITY_STYLES[s.priority]}`}>
                        <div className="flex items-start gap-2">
                          <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-hud text-[9px] uppercase opacity-80">{s.category}</span>
                              <span className="text-hud text-[9px] uppercase opacity-60">· {s.priority}</span>
                            </div>
                            <div className="text-sm font-medium mt-0.5">{s.title}</div>
                            <div className="text-mono text-xs opacity-90 mt-1 whitespace-pre-wrap">{s.detail}</div>
                            {s.actions && s.actions.length > 0 && (
                              <ul className="mt-2 text-xs space-y-0.5">
                                {s.actions.map((a, i) => <li key={i} className="opacity-80">• {a}</li>)}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </section>
              </>
            )}
          </section>
        )}
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

function DiscoveryAnswer({
  q,
  value,
  onChange,
}: {
  q: DiscoveryQuestion;
  value: string | number | boolean | undefined;
  onChange: (v: string | number | boolean) => void;
}) {
  return (
    <div className="rounded-sm border border-border bg-background/40 p-2.5">
      <div className="text-xs mb-1.5">{q.question}{q.critical && <span className="text-cyan ml-1">*</span>}</div>
      {q.type === "yesno" ? (
        <div className="flex gap-2">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt === "Yes")}
              className={`rounded-sm border px-2 py-1 text-[10px] text-hud transition ${
                value === (opt === "Yes")
                  ? "border-cyan bg-cyan/20 text-cyan"
                  : "border-border text-muted-foreground hover:border-cyan/40"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : q.type === "choice" && q.options ? (
        <div className="flex flex-wrap gap-1.5">
          {q.options.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={`rounded-sm border px-2 py-1 text-[10px] text-hud transition ${
                value === opt ? "border-cyan bg-cyan/20 text-cyan" : "border-border text-muted-foreground hover:border-cyan/40"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : q.type === "money" || q.type === "number" ? (
        <input
          type="number"
          value={typeof value === "number" || typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
          className={inputCls}
        />
      ) : (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      )}
    </div>
  );
}

function groupBy<T, K extends string>(arr: T[], keyFn: (t: T) => K): [K, T[]][] {
  const map = new Map<K, T[]>();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return Array.from(map.entries());
}
