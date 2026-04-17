import { useEffect, useState } from "react";
import { ChevronDown, Radar, Loader2 } from "lucide-react";
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
  state: "CA",
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
  scanning: boolean;
}

export function ScenarioForm({ initial, onScan, scanning }: Props) {
  const [s, setS] = useState<BorrowerScenario>(initial ?? DEFAULT);
  const [open, setOpen] = useState({ borrower: true, property: true, prefs: true });

  useEffect(() => {
    if (initial) setS(initial);
  }, [initial]);

  // Recompute LTV when DP changes; recompute DP when loan amount changes.
  const ltv = s.propertyValue > 0 ? (s.loanAmount / s.propertyValue) * 100 : 0;
  const dti = s.monthlyIncome > 0 ? (s.monthlyDebt / s.monthlyIncome) * 100 : 0;

  const set = <K extends keyof BorrowerScenario>(k: K, v: BorrowerScenario[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const toggleArr = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const Section = ({
    id,
    title,
    children,
  }: {
    id: keyof typeof open;
    title: string;
    children: React.ReactNode;
  }) => (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen((p) => ({ ...p, [id]: !p[id] }))}
        className="flex w-full items-center justify-between py-2.5 text-hud text-xs text-cyan"
      >
        <span>{title}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open[id] ? "rotate-180" : ""}`} />
      </button>
      {open[id] && <div className="pb-3 space-y-3">{children}</div>}
    </div>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <div className="text-hud text-[10px] text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );

  const inputCls = "w-full rounded-sm border border-input bg-background/60 px-2.5 py-1.5 text-sm text-mono outline-none focus:border-cyan focus:shadow-[0_0_12px_oklch(0.82_0.16_220/0.25)] transition";

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

      <Field label="Borrower Nickname (for history)">
        <input
          value={s.nickname ?? ""}
          onChange={(e) => set("nickname", e.target.value)}
          placeholder="e.g. Smith Refi"
          className={inputCls}
        />
      </Field>

      <div className="mt-2">
        <Section id="borrower" title="Borrower Profile">
          <Field label={`Credit Score (FICO)`}>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={s.creditScore}
                onChange={(e) => set("creditScore", Number(e.target.value))}
                className={inputCls}
              />
              <div className={`text-mono text-sm font-bold w-12 text-right ${ficoColor(s.creditScore)}`}>{s.creditScore}</div>
            </div>
          </Field>

          <Field label="Income Type">
            <select value={s.incomeType} onChange={(e) => set("incomeType", e.target.value as IncomeType)} className={inputCls}>
              {INCOME_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly Income $">
              <input type="number" value={s.monthlyIncome} onChange={(e) => set("monthlyIncome", Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Monthly Debt $">
              <input type="number" value={s.monthlyDebt} onChange={(e) => set("monthlyDebt", Number(e.target.value))} className={inputCls} />
            </Field>
          </div>

          <Field label="Employment History">
            <select value={s.employmentHistory} onChange={(e) => set("employmentHistory", e.target.value as BorrowerScenario["employmentHistory"])} className={inputCls}>
              <option>2+ years</option>
              <option>1-2 years</option>
              <option>Less than 1 year</option>
              <option>Not applicable</option>
            </select>
          </Field>

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
        </Section>

        <Section id="property" title="Property & Transaction">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loan Purpose">
              <select value={s.loanPurpose} onChange={(e) => set("loanPurpose", e.target.value as LoanPurpose)} className={inputCls}>
                {LOAN_PURPOSES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Occupancy">
              <select value={s.occupancy} onChange={(e) => set("occupancy", e.target.value as Occupancy)} className={inputCls}>
                {OCCUPANCIES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Property Type">
              <select value={s.propertyType} onChange={(e) => set("propertyType", e.target.value as PropertyType)} className={inputCls}>
                {PROP_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="State">
              <select value={s.state} onChange={(e) => set("state", e.target.value)} className={inputCls}>
                {US_STATES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase / Appraised Value $">
              <input type="number" value={s.propertyValue} onChange={(e) => {
                const v = Number(e.target.value);
                set("propertyValue", v);
                if (v > 0) set("downPaymentPct", Number((((v - s.loanAmount) / v) * 100).toFixed(2)));
              }} className={inputCls} />
            </Field>
            <Field label="Loan Amount $">
              <input type="number" value={s.loanAmount} onChange={(e) => {
                const v = Number(e.target.value);
                set("loanAmount", v);
                if (s.propertyValue > 0) set("downPaymentPct", Number((((s.propertyValue - v) / s.propertyValue) * 100).toFixed(2)));
              }} className={inputCls} />
            </Field>
          </div>
          <Field label={`Down Payment % (LTV ${ltv.toFixed(1)}%)`}>
            <input type="number" step="0.5" value={s.downPaymentPct} onChange={(e) => {
              const dp = Number(e.target.value);
              set("downPaymentPct", dp);
              set("loanAmount", Math.round(s.propertyValue * (1 - dp / 100)));
            }} className={inputCls} />
          </Field>
        </Section>

        <Section id="prefs" title="Loan Preferences">
          <Field label="Loan Type Preferences">
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
          </Field>

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
            <Field label="Max Rate %">
              <input type="number" step="0.125" value={s.maxRate ?? ""} onChange={(e) => set("maxRate", e.target.value ? Number(e.target.value) : undefined)} className={inputCls} placeholder="e.g. 7.5" />
            </Field>
            <Field label="Preferred Terms">
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
            </Field>
          </div>

          <Field label="Special Needs">
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
          </Field>
        </Section>
      </div>

      <button
        onClick={() => onScan(s)}
        disabled={scanning}
        className="mt-4 w-full relative group overflow-hidden rounded-sm border border-cyan bg-gradient-to-r from-cyan/30 via-blue-accent/20 to-cyan/30 px-4 py-3 text-hud text-sm text-cyan tracking-widest font-bold animate-pulse-glow disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
          {scanning ? "SCANNING..." : "SCAN FOR MATCHES"}
        </span>
      </button>
    </div>
  );
}
