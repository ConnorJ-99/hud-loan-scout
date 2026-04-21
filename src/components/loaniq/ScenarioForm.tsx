import { useEffect, useState, useCallback } from "react";
import { ChevronDown, Radar, Loader2, RotateCcw } from "lucide-react";
import type { BorrowerScenario, IncomeType, LoanPurpose, LoanType, LoanTerm, Occupancy, PropertyType, SpecialNeed } from "@/lib/loaniq/types";
import { US_STATES } from "@/lib/loaniq/states";

const DEFAULT: BorrowerScenario = {
  nickname: "",
  creditScore: 680,
  incomeType: "W2",
  monthlyIncome: 8500,
  monthlyDebt: 1800,
  employmentHistory: "2+ years",
  hasBankruptcy: false,
  hasForeclosure: false,
  loanPurpose: "Purchase",
  propertyType: "SFR",
  occupancy: "Primary",
  state: "TX",
  propertyValue: 500000,
  loanAmount: 425000,
  downPaymentPct: 15,
  loanTypePrefs: ["Conventional", "FHA"],
  needsDPA: false,
  preferredTerms: ["30yr"],
  specialNeeds: [],
};

const INCOME_TYPES: IncomeType[] = ["W2", "Self-Employed 1099", "Bank Statement", "DSCR/No-Doc", "Retired/Asset Depletion"];
const LOAN_PURPOSES: LoanPurpose[] = ["Purchase", "Refinance", "Cash-Out Refi"];
const PROP_TYPES: PropertyType[] = ["SFR", "Condo", "2-4 Unit", "5+ Unit Multifamily", "Mixed Use", "Commercial"];
const OCCUPANCIES: Occupancy[] = ["Primary", "Second Home", "Investment"];
const LOAN_TYPES: LoanType[] = ["FHA", "VA", "USDA", "Conventional", "Jumbo", "Non-QM", "DSCR", "Hard Money", "Bridge"];
const TERMS: LoanTerm[] = ["15yr", "20yr", "30yr", "40yr", "IO"];
const SPECIAL: SpecialNeed[] = ["Gift funds", "Co-borrower", "Foreign National", "ITIN", "First-Time Buyer", "Manufactured Home"];

function ficoColor(s: number) {
  if (s < 580) return "text-destructive";
  if (s < 640) return "text-warn";
  return "text-success";
}

interface Props {
  initial?: BorrowerScenario;
  onScan: (s: BorrowerScenario) => void;
  onReset?: () => void;
  scanning: boolean;
}

const inputCls = "w-full rounded-sm border border-input bg-background/60 px-2.5 py-1.5 text-sm text-mono outline-none focus:border-cyan focus:shadow-[0_0_12px_oklch(0.82_0.16_220/0.25)] transition";

function SectionHeader({ title, isOpen, onToggle }: { title: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between py-2.5 text-hud text-xs text-cyan"
    >
      <span>{title}</span>
      <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} />
    </button>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-hud text-[10px] text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

export function ScenarioForm({ initial, onScan, onReset, scanning }: Props) {
  const [s, setS] = useState<BorrowerScenario>(initial ?? DEFAULT);
  const [open, setOpen] = useState({ borrower: true, property: true, prefs: true });

  useEffect(() => {
    if (initial) setS(initial);
  }, [initial]);

  const ltv = s.propertyValue > 0 ? (s.loanAmount / s.propertyValue) * 100 : 0;
  const dti = s.monthlyIncome > 0 ? (s.monthlyDebt / s.monthlyIncome) * 100 : 0;

  const set = useCallback(<K extends keyof BorrowerScenario>(k: K, v: BorrowerScenario[K]) =>
    setS((prev) => ({ ...prev, [k]: v })), []);

  const toggleArr = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const handleReset = () => {
    setS(DEFAULT);
    onReset?.();
  };

  const toggleSection = useCallback((id: keyof typeof open) => {
    setOpen((p) => ({ ...p, [id]: !p[id] }));
  }, []);

  return (
    <div className="hud-panel rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-hud text-xs text-cyan">BORROWER SCENARIO</div>
          <div className="text-hud text-[10px] text-muted-foreground">// input parameters</div>
        </div>
        <div className="flex gap-3 text-right">
          <div>
            <div className="text-hud text-[9px] text-muted-foreground">LTV</div>
            <div className="text-mono text-sm text-cyan">{ltv.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-hud text-[9px] text-muted-foreground">DTI</div>
            <div className="text-mono text-sm text-cyan">{dti.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <FieldLabel label="Borrower Nickname (for history)">
        <input
          value={s.nickname ?? ""}
          onChange={(e) => set("nickname", e.target.value)}
          placeholder="e.g. Smith Refi"
          className={inputCls}
        />
      </FieldLabel>

      <div className="mt-2">
        {/* Borrower Profile Section */}
        <div className="border-b border-border">
          <SectionHeader title="Borrower Profile" isOpen={open.borrower} onToggle={() => toggleSection("borrower")} />
          {open.borrower && (
            <div className="pb-3 space-y-3">
              <FieldLabel label="Credit Score (FICO)">
                <div className="flex items-center gap-2">
                  <input type="number" value={s.creditScore} onChange={(e) => set("creditScore", Number(e.target.value))} className={inputCls} />
                  <div className={`text-mono text-sm font-bold w-12 text-right ${ficoColor(s.creditScore)}`}>{s.creditScore}</div>
                </div>
              </FieldLabel>

              <FieldLabel label="Income Type">
                <select value={s.incomeType} onChange={(e) => set("incomeType", e.target.value as IncomeType)} className={inputCls}>
                  {INCOME_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FieldLabel>

              <div className="grid grid-cols-2 gap-3">
                <FieldLabel label="Monthly Income $">
                  <input type="number" value={s.monthlyIncome} onChange={(e) => set("monthlyIncome", Number(e.target.value))} className={inputCls} />
                </FieldLabel>
                <FieldLabel label="Monthly Debt $">
                  <input type="number" value={s.monthlyDebt} onChange={(e) => set("monthlyDebt", Number(e.target.value))} className={inputCls} />
                </FieldLabel>
              </div>

              <FieldLabel label="Employment History">
                <select value={s.employmentHistory} onChange={(e) => set("employmentHistory", e.target.value as BorrowerScenario["employmentHistory"])} className={inputCls}>
                  <option>2+ years</option>
                  <option>1-2 years</option>
                  <option>Less than 1 year</option>
                  <option>Not applicable</option>
                </select>
              </FieldLabel>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={s.hasBankruptcy} onChange={(e) => set("hasBankruptcy", e.target.checked)} className="accent-cyan" />
                  <span>Bankruptcy on file</span>
                </label>
                {s.hasBankruptcy && (
                  <input type="date" value={s.bankruptcyDate ?? ""} onChange={(e) => set("bankruptcyDate", e.target.value)} className={inputCls} />
                )}
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={s.hasForeclosure} onChange={(e) => set("hasForeclosure", e.target.checked)} className="accent-cyan" />
                  <span>Foreclosure on file</span>
                </label>
                {s.hasForeclosure && (
                  <input type="date" value={s.foreclosureDate ?? ""} onChange={(e) => set("foreclosureDate", e.target.value)} className={inputCls} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Property & Transaction Section */}
        <div className="border-b border-border">
          <SectionHeader title="Property & Transaction" isOpen={open.property} onToggle={() => toggleSection("property")} />
          {open.property && (
            <div className="pb-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FieldLabel label="Loan Purpose">
                  <select value={s.loanPurpose} onChange={(e) => set("loanPurpose", e.target.value as LoanPurpose)} className={inputCls}>
                    {LOAN_PURPOSES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </FieldLabel>
                <FieldLabel label="Occupancy">
                  <select value={s.occupancy} onChange={(e) => set("occupancy", e.target.value as Occupancy)} className={inputCls}>
                    {OCCUPANCIES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </FieldLabel>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldLabel label="Property Type">
                  <select value={s.propertyType} onChange={(e) => set("propertyType", e.target.value as PropertyType)} className={inputCls}>
                    {PROP_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </FieldLabel>
                <FieldLabel label="State">
                  <select value={s.state} onChange={(e) => set("state", e.target.value)} className={inputCls}>
                    {US_STATES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </FieldLabel>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldLabel label="Purchase / Appraised Value $">
                  <input type="number" value={s.propertyValue} onChange={(e) => {
                    const v = Number(e.target.value);
                    setS((prev) => ({
                      ...prev,
                      propertyValue: v,
                      downPaymentPct: v > 0 ? Number((((v - prev.loanAmount) / v) * 100).toFixed(2)) : prev.downPaymentPct,
                    }));
                  }} className={inputCls} />
                </FieldLabel>
                <FieldLabel label="Loan Amount $">
                  <input type="number" value={s.loanAmount} onChange={(e) => {
                    const v = Number(e.target.value);
                    setS((prev) => ({
                      ...prev,
                      loanAmount: v,
                      downPaymentPct: prev.propertyValue > 0 ? Number((((prev.propertyValue - v) / prev.propertyValue) * 100).toFixed(2)) : prev.downPaymentPct,
                    }));
                  }} className={inputCls} />
                </FieldLabel>
              </div>
              <FieldLabel label={`Down Payment % (LTV ${ltv.toFixed(1)}%)`}>
                <input type="number" step="0.5" value={s.downPaymentPct} onChange={(e) => {
                  const dp = Number(e.target.value);
                  setS((prev) => ({
                    ...prev,
                    downPaymentPct: dp,
                    loanAmount: Math.round(prev.propertyValue * (1 - dp / 100)),
                  }));
                }} className={inputCls} />
              </FieldLabel>
            </div>
          )}
        </div>

        {/* Loan Preferences Section */}
        <div className="border-b border-border last:border-b-0">
          <SectionHeader title="Loan Preferences" isOpen={open.prefs} onToggle={() => toggleSection("prefs")} />
          {open.prefs && (
            <div className="pb-3 space-y-3">
              <FieldLabel label="Loan Type Preferences">
                <div className="flex flex-wrap gap-1.5">
                  {LOAN_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => set("loanTypePrefs", toggleArr(s.loanTypePrefs, t))}
                      className={`rounded-sm border px-2 py-1 text-[10px] text-hud transition ${
                        s.loanTypePrefs.includes(t)
                          ? "border-cyan bg-cyan/20 text-cyan"
                          : "border-border text-muted-foreground hover:border-cyan/40"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </FieldLabel>

              <label className="flex items-center justify-between text-xs">
                <span>Down Payment Assistance Needed</span>
                <button
                  onClick={() => set("needsDPA", !s.needsDPA)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${s.needsDPA ? "bg-cyan" : "bg-muted"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-background transition ${s.needsDPA ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <FieldLabel label="Max Rate %">
                  <input type="number" step="0.125" value={s.maxRate ?? ""} onChange={(e) => set("maxRate", e.target.value ? Number(e.target.value) : undefined)} className={inputCls} placeholder="e.g. 7.5" />
                </FieldLabel>
                <FieldLabel label="Preferred Terms">
                  <div className="flex flex-wrap gap-1">
                    {TERMS.map((t) => (
                      <button
                        key={t}
                        onClick={() => set("preferredTerms", toggleArr(s.preferredTerms, t))}
                        className={`rounded-sm border px-1.5 py-0.5 text-[10px] text-hud transition ${
                          s.preferredTerms.includes(t)
                            ? "border-cyan bg-cyan/20 text-cyan"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </FieldLabel>
              </div>

              <FieldLabel label="Special Needs">
                <div className="flex flex-wrap gap-1.5">
                  {SPECIAL.map((t) => (
                    <button
                      key={t}
                      onClick={() => set("specialNeeds", toggleArr(s.specialNeeds, t))}
                      className={`rounded-sm border px-2 py-1 text-[10px] text-hud transition ${
                        s.specialNeeds.includes(t)
                          ? "border-cyan bg-cyan/20 text-cyan"
                          : "border-border text-muted-foreground hover:border-cyan/40"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </FieldLabel>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleReset}
          className="rounded-sm border border-border px-3 py-3 text-hud text-xs text-muted-foreground hover:border-warn/60 hover:text-warn transition flex items-center gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          RESET
        </button>
        <button
          onClick={() => onScan(s)}
          disabled={scanning}
          className="flex-1 relative group overflow-hidden rounded-sm border border-cyan bg-gradient-to-r from-cyan/30 via-blue-accent/20 to-cyan/30 px-4 py-3 text-hud text-sm text-cyan tracking-widest font-bold animate-pulse-glow disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            {scanning ? "SCANNING..." : "SCAN FOR MATCHES"}
          </span>
        </button>
      </div>
    </div>
  );
}
