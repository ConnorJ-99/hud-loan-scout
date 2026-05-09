import { useEffect, useMemo, useState } from "react";
import type { BorrowerScenario, Lender, LenderProduct, MatchResult, LoanType } from "@/lib/loaniq/types";
import { Flag, ChevronRight, Sparkles, Loader2, Bug } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { store } from "@/lib/loaniq/storage";
import { toast } from "sonner";
import { rankMatchesDebug } from "@/lib/loaniq/match";

interface Props {
  scenario: BorrowerScenario | null;
  matches: MatchResult[];
  lenders: Lender[];
  products: LenderProduct[];
  scanning: boolean;
  aiAnalysis: string;
  aiLoading: boolean;
}

const STATUS_COLOR: Record<MatchResult["status"], string> = {
  "STRONG MATCH": "border-success/60 text-success bg-success/10",
  "POSSIBLE MATCH": "border-cyan/60 text-cyan bg-cyan/10",
  "CONDITIONAL MATCH": "border-warn/60 text-warn bg-warn/10",
  "FILTERED": "border-destructive/60 text-destructive bg-destructive/10",
};

function MatchGauge({ score }: { score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const off = c - (score / 100) * c;
  const color = score >= 80 ? "var(--color-success)" : score >= 60 ? "var(--color-cyan)" : "var(--color-warn)";
  return (
    <div className="relative h-14 w-14 flex-shrink-0">
      <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
        <circle cx="30" cy="30" r={r} stroke="oklch(0.32 0.08 235 / 0.3)" strokeWidth="3" fill="none" />
        <circle cx="30" cy="30" r={r} stroke={color} strokeWidth="3" fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-mono text-sm font-bold" style={{ color }}>
        {score}
      </div>
    </div>
  );
}

export function ResultsPanel({ scenario, matches, lenders, products, scanning, aiAnalysis, aiLoading }: Props) {
  const [sortBy, setSortBy] = useState<"score" | "fico" | "ltv" | "name">("score");
  const [filterLoanType, setFilterLoanType] = useState<LoanType | "ALL">("ALL");
  const [filterDPA, setFilterDPA] = useState(false);
  const [drawerProduct, setDrawerProduct] = useState<LenderProduct | null>(null);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [showAI, setShowAI] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [showFiltered, setShowFiltered] = useState(true);

  const debugFiltered = useMemo(() => {
    if (!debugMode || !scenario) return [];
    return rankMatchesDebug(scenario, products).filtered;
  }, [debugMode, scenario, products]);

  useEffect(() => { setShortlist(store.getShortlist()); }, []);

  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const lenderById = useMemo(() => Object.fromEntries(lenders.map((l) => [l.id, l])), [lenders]);

  const filtered = useMemo(() => {
    let arr = [...matches];
    if (filterLoanType !== "ALL") {
      arr = arr.filter((m) => productById[m.productId]?.loanTypes.includes(filterLoanType));
    }
    if (filterDPA) {
      arr = arr.filter((m) => productById[m.productId]?.dpaAvailable);
    }
    arr.sort((a, b) => {
      const pa = productById[a.productId]; const pb = productById[b.productId];
      if (!pa || !pb) return 0;
      if (sortBy === "score") return b.matchScore - a.matchScore;
      if (sortBy === "fico") return pa.minFico - pb.minFico;
      if (sortBy === "ltv") return pb.maxLtv - pa.maxLtv;
      return pa.productName.localeCompare(pb.productName);
    });
    return arr;
  }, [matches, sortBy, filterLoanType, filterDPA, productById]);

  const flag = (id: string) => {
    const next = shortlist.includes(id) ? shortlist.filter((x) => x !== id) : [...shortlist, id];
    setShortlist(next);
    store.setShortlist(next);
    toast.success(shortlist.includes(id) ? "Removed from shortlist" : "Flagged to shortlist");
  };

  if (!scenario && !scanning && matches.length === 0) {
    return (
      <div className="hud-panel rounded-md p-12 text-center">
        <div className="mx-auto h-32 w-32 relative mb-4">
          <div className="absolute inset-0 rounded-full border border-cyan/20" />
          <div className="absolute inset-2 rounded-full border border-cyan/30" />
          <div className="absolute inset-4 rounded-full border border-cyan/40" />
          <div className="absolute inset-0 origin-center animate-radar">
            <div className="absolute top-1/2 left-1/2 h-px w-1/2 bg-gradient-to-r from-cyan to-transparent" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-cyan animate-data-pulse" />
          </div>
        </div>
        <div className="text-hud text-cyan mb-1">AWAITING SCENARIO INPUT</div>
        <p className="text-sm text-muted-foreground text-mono">&gt; Configure borrower parameters and execute SCAN.</p>
      </div>
    );
  }

  if (scanning) {
    return (
      <div className="hud-panel rounded-md p-12 text-center scanline">
        <div className="mx-auto h-40 w-40 relative mb-6">
          {[0,1,2,3].map((i) => (
            <div key={i} className="absolute inset-0 rounded-full border border-cyan/30" style={{ transform: `scale(${0.4 + i * 0.2})` }} />
          ))}
          <div className="absolute inset-0 origin-center animate-radar">
            <div className="absolute top-1/2 left-1/2 h-px w-1/2 bg-gradient-to-r from-cyan via-cyan/60 to-transparent" style={{ filter: "drop-shadow(0 0 8px var(--color-cyan))" }} />
          </div>
        </div>
        <div className="text-hud text-cyan glow-cyan animate-data-pulse">SCANNING LENDER CATALOG</div>
        <p className="text-xs text-mono text-muted-foreground mt-2">&gt; cross-referencing {products.length} products against scenario...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hud-panel rounded-md p-3 flex flex-wrap items-center gap-3">
        <div className="text-hud text-xs text-cyan">
          {filtered.length} <span className="text-muted-foreground">of {products.length} products matched</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "score" | "fico" | "ltv" | "name")}
            className="rounded-sm border border-border bg-background/60 px-2 py-1 text-xs text-mono">
            <option value="score">Sort: Match Score</option>
            <option value="fico">Sort: Min FICO</option>
            <option value="ltv">Sort: Max LTV</option>
            <option value="name">Sort: Lender Name</option>
          </select>
          <select value={filterLoanType} onChange={(e) => setFilterLoanType(e.target.value as LoanType | "ALL")}
            className="rounded-sm border border-border bg-background/60 px-2 py-1 text-xs text-mono">
            <option value="ALL">All Loan Types</option>
            {(["FHA","VA","USDA","Conventional","Jumbo","Non-QM","DSCR","Hard Money","Bridge"] as LoanType[]).map((t) => <option key={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-mono">
            <input type="checkbox" checked={filterDPA} onChange={(e) => setFilterDPA(e.target.checked)} className="accent-cyan" />
            DPA only
          </label>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="hud-panel rounded-md p-8 text-center">
          <div className="text-hud text-warn mb-2">NO MATCHES</div>
          <p className="text-xs text-muted-foreground text-mono">&gt; Try loosening filters or adjusting borrower parameters.</p>
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map((m, idx) => {
          const p = productById[m.productId];
          const l = p ? lenderById[p.lenderId] : undefined;
          if (!p || !l) return null;
          const flagged = shortlist.includes(p.id);
          return (
            <div key={p.id} className="hud-panel rounded-md p-4 animate-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
              <div className="flex items-start gap-4">
                <MatchGauge score={m.matchScore} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-hud text-[10px] text-muted-foreground">{l.name}</div>
                      <div className="text-base font-semibold text-foreground truncate">{p.productName}</div>
                    </div>
                    <div className={`shrink-0 rounded-sm border px-2 py-0.5 text-hud text-[10px] ${STATUS_COLOR[m.status]}`}>
                      {m.status}
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-muted-foreground text-hud text-[9px] block">MIN FICO</span><span className="text-mono">{p.minFico}</span></div>
                    <div><span className="text-muted-foreground text-hud text-[9px] block">MAX LTV</span><span className="text-mono">{p.maxLtv}%</span></div>
                    <div><span className="text-muted-foreground text-hud text-[9px] block">MAX DTI</span><span className="text-mono">{p.maxDti > 0 ? `${p.maxDti}%` : "N/A"}</span></div>
                    <div><span className="text-muted-foreground text-hud text-[9px] block">LOAN TYPES</span><span className="text-mono text-[11px]">{p.loanTypes.join(", ")}</span></div>
                  </div>

                  {m.highlights.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.highlights.map((h, i) => (
                        <span key={i} className="rounded-sm bg-success/10 border border-success/40 px-1.5 py-0.5 text-[10px] text-success text-mono">+ {h}</span>
                      ))}
                    </div>
                  )}
                  {m.caveats.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.caveats.map((h, i) => (
                        <span key={i} className="rounded-sm bg-warn/10 border border-warn/40 px-1.5 py-0.5 text-[10px] text-warn text-mono">! {h}</span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={() => setDrawerProduct(p)} className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] text-hud text-muted-foreground hover:border-cyan/60 hover:text-cyan transition">
                      Full Guidelines <ChevronRight className="h-3 w-3" />
                    </button>
                    <button onClick={() => flag(p.id)} className={`flex items-center gap-1 rounded-sm border px-2 py-1 text-[10px] text-hud transition ${flagged ? "border-warn bg-warn/10 text-warn" : "border-border text-muted-foreground hover:border-warn/60 hover:text-warn"}`}>
                      <Flag className="h-3 w-3" />
                      {flagged ? "Flagged" : "Flag"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(aiLoading || aiAnalysis) && (
        <div className="hud-panel rounded-md p-4">
          <button onClick={() => setShowAI((v) => !v)} className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan" />
              <span className="text-hud text-xs text-cyan">JARVIS ANALYSIS</span>
              {aiLoading && <Loader2 className="h-3 w-3 animate-spin text-cyan" />}
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition ${showAI ? "rotate-90" : ""}`} />
          </button>
          {showAI && (
            <div className="mt-3 rounded-sm border border-cyan/20 bg-background/60 p-3 scanline">
              {aiLoading && !aiAnalysis ? (
                <div className="text-mono text-xs text-muted-foreground">
                  <span>cross-referencing scenario against catalog</span>
                  <span className="terminal-cursor" />
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Sheet open={!!drawerProduct} onOpenChange={(v) => !v && setDrawerProduct(null)}>
        <SheetContent className="bg-panel border-l border-cyan/30 w-full sm:max-w-lg overflow-y-auto">
          {drawerProduct && (
            <>
              <SheetHeader>
                <SheetTitle className="text-hud text-cyan glow-cyan">
                  {lenderById[drawerProduct.lenderId]?.name} — {drawerProduct.productName}
                </SheetTitle>
              </SheetHeader>
              <dl className="mt-4 space-y-2 text-xs">
                {Object.entries({
                  "Min FICO": drawerProduct.minFico,
                  "Max LTV": `${drawerProduct.maxLtv}%`,
                  "Max DTI": drawerProduct.maxDti > 0 ? `${drawerProduct.maxDti}%` : "N/A",
                  "Loan Types": drawerProduct.loanTypes.join(", "),
                  "Income Types": drawerProduct.incomeTypesAllowed.join(", "),
                  "Property Types": drawerProduct.propertyTypesAllowed.join(", "),
                  "Occupancies": drawerProduct.occupancies.join(", "),
                  "DPA Available": drawerProduct.dpaAvailable ? `Yes${drawerProduct.dpaMinFico ? ` (min ${drawerProduct.dpaMinFico} FICO)` : ""}` : "No",
                  "Gift Funds": drawerProduct.giftFundsAllowed ? "Yes" : "No",
                  "States": drawerProduct.states.includes("ALL") ? "All states" : drawerProduct.states.join(", "),
                  "Special Programs": drawerProduct.specialPrograms.join(", ") || "—",
                  "Tags": drawerProduct.tags.join(", ") || "—",
                }).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-border py-1.5">
                    <dt className="text-hud text-[10px] text-muted-foreground shrink-0">{k}</dt>
                    <dd className="text-mono text-right">{String(v)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4">
                <div className="text-hud text-[10px] text-muted-foreground mb-1">NOTES</div>
                <p className="text-sm text-foreground/90">{drawerProduct.notes}</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
