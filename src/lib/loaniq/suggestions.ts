/**
 * Guideline-aware suggestion engine for borrower prequal profiles.
 *
 * Produces categorized, prioritized findings using deterministic rules over the
 * borrower scenario and the live loan_programs / overlays catalog. The output
 * can then be passed to the AI polish endpoint to be rewritten in an
 * experienced-LO/underwriter voice.
 */
import type { BorrowerScenario, LenderProduct } from "./types";

export type SuggestionCategory =
  | "Opportunity"
  | "Risk"
  | "Guideline Warning"
  | "Possible Solution"
  | "Documentation Needed";

export type SuggestionPriority = "Low" | "Medium" | "High" | "Critical";

export interface Suggestion {
  id: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  title: string;
  detail: string;
  /** Optional product/program ids this suggestion references. */
  productIds?: string[];
  /** Optional structured action hints for downstream UI. */
  actions?: string[];
}

export interface SuggestionContext {
  ltv: number;
  dti: number;
  cashAvailable: number;
  estimatedCashToClose: number;
  reservesMonths: number | null;
}

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function compute(s: BorrowerScenario, opts: { assets?: number; reservesMonths?: number } = {}): SuggestionContext {
  const ltv = s.propertyValue > 0 ? (s.loanAmount / s.propertyValue) * 100 : 0;
  const dti = s.monthlyIncome > 0 ? (s.monthlyDebt / s.monthlyIncome) * 100 : 0;
  const downPayment = (s.propertyValue * s.downPaymentPct) / 100;
  // Rough closing-cost estimate: 3% of purchase price (broker-side conservative)
  const estimatedClosing = s.propertyValue * 0.03;
  const estimatedCashToClose = downPayment + estimatedClosing;
  return {
    ltv,
    dti,
    cashAvailable: opts.assets ?? 0,
    estimatedCashToClose,
    reservesMonths: opts.reservesMonths ?? null,
  };
}

/**
 * Main entry point. Returns an array of suggestions ordered by priority.
 *
 * @param scenario - the borrower scenario form values
 * @param products - the LIVE catalog (already filtered to broker's state by caller)
 * @param extras - optional asset / reserve answers from discovery flow
 */
export function generateSuggestions(
  scenario: BorrowerScenario,
  products: LenderProduct[],
  extras: { assets?: number; reservesMonths?: number } = {},
): { suggestions: Suggestion[]; context: SuggestionContext } {
  const ctx = compute(scenario, extras);
  const out: Suggestion[] = [];

  // ============ CREDIT ============
  if (scenario.creditScore < 580) {
    // Find FHA products and check their dpa_min_fico to see if any allow <580
    const fhaProducts = products.filter((p) =>
      p.loanTypes.some((t) => t.toLowerCase() === "fha"),
    );
    const fhaSub580 = fhaProducts.filter((p) => p.minFico <= scenario.creditScore);
    const downAtTenPct = scenario.propertyValue * 0.1;
    const cashGap = downAtTenPct + scenario.propertyValue * 0.03 - ctx.cashAvailable;

    if (fhaSub580.length === 0) {
      out.push({
        id: "credit-below-580-fha-10pct",
        category: "Guideline Warning",
        priority: "Critical",
        title: `Credit ${scenario.creditScore} likely requires 10% down on FHA`,
        detail:
          `FHA overlays typically require 10% down when FICO is under 580. Estimated cash needed: ` +
          `${fmtMoney(downAtTenPct + scenario.propertyValue * 0.03)} (10% down + ~3% closing).` +
          (ctx.cashAvailable > 0 && cashGap > 0
            ? ` Borrower appears short by ~${fmtMoney(cashGap)}.`
            : ""),
        actions: [
          "Improve score above 580 to unlock 3.5% down",
          "Increase verified assets",
          "Add a co-borrower with stronger credit",
          "Review DPA eligibility once score is above the program minimum",
        ],
      });
    } else {
      out.push({
        id: "credit-below-580-niche-fha",
        category: "Opportunity",
        priority: "High",
        title: `${fhaSub580.length} FHA product(s) accept FICO ${scenario.creditScore}`,
        detail: "At least one program in catalog accepts sub-580 FICO. Verify overlays and DPA pairing.",
        productIds: fhaSub580.map((p) => p.id),
      });
    }
  } else if (scenario.creditScore < 620) {
    out.push({
      id: "credit-580-619-conv-blocked",
      category: "Risk",
      priority: "High",
      title: "Score 580–619 blocks most Conventional pricing",
      detail:
        "FHA/VA remain viable but Conventional pricing/PMI is punitive in this band. " +
        "Consider rapid rescore (if realistic) or stay FHA/VA-focused.",
      actions: ["Rapid rescore if quick wins exist", "Run FHA + DPA comparison", "Check VA entitlement if eligible"],
    });
  } else if (scenario.creditScore >= 740) {
    out.push({
      id: "credit-740-plus-opportunity",
      category: "Opportunity",
      priority: "Low",
      title: "Strong credit — qualify for best Conventional pricing",
      detail: "FICO ≥740 unlocks tier-one Conventional pricing and PMI buyout/removal opportunities.",
    });
  }

  // ============ DTI ============
  if (ctx.dti >= 50) {
    out.push({
      id: "dti-over-50",
      category: "Risk",
      priority: "Critical",
      title: `DTI ${ctx.dti.toFixed(1)}% exceeds most agency caps`,
      detail:
        "Only FHA AUS-approved scenarios or specific Non-QM products tolerate >50%. " +
        "Recommend identifying highest-payment, lowest-balance trade lines to pay off " +
        "for the largest DTI improvement.",
      actions: [
        "List liabilities by monthly payment / payoff ratio",
        "Model DTI after paying off the top 2 highest payments",
        "Evaluate Non-QM bank-statement programs if income is understated",
      ],
    });
  } else if (ctx.dti >= 43) {
    out.push({
      id: "dti-43-49",
      category: "Guideline Warning",
      priority: "Medium",
      title: `DTI ${ctx.dti.toFixed(1)}% near typical caps`,
      detail: "AUS may still approve, but pricing and reserves expectations tighten. Verify before issuing PreQual.",
    });
  }

  // ============ ASSETS / CASH TO CLOSE ============
  if (extras.assets != null) {
    const cashGap = ctx.estimatedCashToClose - ctx.cashAvailable;
    if (cashGap > 0) {
      out.push({
        id: "assets-short-cash-to-close",
        category: "Risk",
        priority: cashGap > ctx.estimatedCashToClose * 0.5 ? "Critical" : "High",
        title: `Estimated short ~${fmtMoney(cashGap)} on cash to close`,
        detail:
          `Estimated need: ${fmtMoney(ctx.estimatedCashToClose)} ` +
          `(down + ~3% closing). Verified assets: ${fmtMoney(ctx.cashAvailable)}.`,
        actions: [
          "Lower purchase range",
          "Pursue seller concessions (up to program max)",
          "Document gift funds (verify program allows)",
          "Explore DPA if FICO threshold is met",
        ],
      });
    }
  }

  // ============ RESERVES ============
  if (extras.reservesMonths != null && extras.reservesMonths < 2) {
    const reserveHeavy = products.filter(
      (p) =>
        p.productType?.toLowerCase().includes("dscr") ||
        p.productType?.toLowerCase().includes("jumbo") ||
        p.loanTypes.some((t) => t.toLowerCase().includes("jumbo")),
    );
    out.push({
      id: "reserves-weak",
      category: "Guideline Warning",
      priority: "Medium",
      title: "Weak reserves limit Jumbo / DSCR options",
      detail:
        "Most Jumbo and DSCR programs require 6–12 months PITI in reserves post-close. " +
        "Steer toward FHA/VA/Conventional with lower reserve requirements.",
      productIds: reserveHeavy.map((p) => p.id),
    });
  }

  // ============ OCCUPANCY / DPA ============
  if (scenario.needsDPA && scenario.occupancy !== "Primary") {
    out.push({
      id: "dpa-non-primary",
      category: "Guideline Warning",
      priority: "High",
      title: "DPA only available on primary residences",
      detail: `Borrower selected DPA + ${scenario.occupancy}. DPA programs are primary-only — adjust occupancy or remove DPA need.`,
    });
  }

  // ============ EMPLOYMENT / INCOME TYPE ============
  if (scenario.employmentHistory === "Less than 1 year") {
    out.push({
      id: "employment-short",
      category: "Documentation Needed",
      priority: "High",
      title: "Less than 1 year employment history",
      detail:
        "Most agency products require 2-year work history. Need offer letter, school/training transcripts " +
        "showing same line of work, or 24-month gap explanation.",
      actions: ["Collect offer letter", "Collect prior employer VOE", "Collect education/training records"],
    });
  }

  if (scenario.incomeType === "Self-Employed 1099") {
    out.push({
      id: "se-docs-needed",
      category: "Documentation Needed",
      priority: "High",
      title: "Self-employed income workup required",
      detail:
        "Need 2 years personal + business tax returns, YTD P&L, and business bank statements. " +
        "Watch for heavy write-offs — they reduce qualifying income on full-doc programs. " +
        "Consider Non-QM bank-statement programs if write-offs kill qualification.",
      actions: [
        "Collect 2yr 1040s + Schedule C / 1120S / K-1",
        "Run write-off impact on AGI",
        "Quote bank-statement alternative for comparison",
      ],
    });
  }
  if (scenario.incomeType === "Bank Statement") {
    out.push({
      id: "bankstmt-docs",
      category: "Documentation Needed",
      priority: "Medium",
      title: "Bank-statement income — 12 or 24 month workup",
      detail:
        "Standardize on 12 or 24 months business bank statements. Expense factor varies by lender " +
        "(typically 30–50%). Compare lender expense factors before committing — it can swing qualifying income substantially.",
    });
  }

  // ============ LOAN TYPE COVERAGE ============
  if (scenario.loanTypePrefs.includes("VA")) {
    out.push({
      id: "va-entitlement",
      category: "Opportunity",
      priority: "Medium",
      title: "Confirm VA entitlement and funding-fee exemption",
      detail:
        "Pull COE early. Disabled-veteran exemption from funding fee can swing payment materially. " +
        "Verify second-tier entitlement if borrower has existing VA loan.",
      actions: ["Request Certificate of Eligibility", "Confirm disability rating (funding fee exemption)"],
    });
  }
  if (scenario.loanTypePrefs.includes("Conventional") && ctx.ltv <= 80) {
    out.push({
      id: "conv-no-pmi",
      category: "Opportunity",
      priority: "Low",
      title: "Conventional at ≤80% LTV avoids PMI",
      detail: `LTV ${ctx.ltv.toFixed(1)}% — no PMI required. Compare against FHA all-in payment (FHA carries upfront + monthly MIP).`,
    });
  }
  if (scenario.loanPurpose === "Refinance" || scenario.loanPurpose === "Cash-Out Refi") {
    out.push({
      id: "refi-goal-discovery",
      category: "Documentation Needed",
      priority: "Medium",
      title: "Confirm refinance goal before product selection",
      detail:
        "Lower payment, cash-out, PMI removal, and term shortening lead to different product choices. " +
        "Pull current note rate + balance + payoff statement.",
    });
  }

  // ============ BANKRUPTCY / FORECLOSURE SEASONING ============
  if (scenario.hasBankruptcy && scenario.bankruptcyDate) {
    const months = monthsSince(scenario.bankruptcyDate);
    out.push({
      id: "bk-seasoning",
      category: "Guideline Warning",
      priority: months < 24 ? "Critical" : months < 48 ? "High" : "Medium",
      title: `Bankruptcy seasoning: ${months} months since discharge`,
      detail:
        `FHA/VA: 24mo Ch.7 from discharge. Conv: 48mo Ch.7. Non-QM: as little as 12mo with overlays. ` +
        (months < 24
          ? "Borrower is under 24 months — Non-QM may be the only realistic path."
          : ""),
    });
  }
  if (scenario.hasForeclosure && scenario.foreclosureDate) {
    const months = monthsSince(scenario.foreclosureDate);
    out.push({
      id: "fc-seasoning",
      category: "Guideline Warning",
      priority: months < 36 ? "Critical" : months < 84 ? "High" : "Medium",
      title: `Foreclosure seasoning: ${months} months`,
      detail: `FHA: 36mo. Conv: 7yr. VA: 24mo. Non-QM: 12–36mo with rate impact.`,
    });
  }

  // ============ CATALOG SHORT-LIST AWARENESS ============
  if (products.length > 0) {
    // Count products that survive a minimal hard filter (FICO + LTV + state + occupancy)
    const eligible = products.filter(
      (p) =>
        scenario.creditScore >= p.minFico &&
        (ctx.ltv === 0 || ctx.ltv <= p.maxLtv + 0.5) &&
        (p.states.length === 0 || p.states.includes("ALL") || p.states.includes(scenario.state)) &&
        (p.occupancies.length === 0 || p.occupancies.includes(scenario.occupancy)),
    );
    if (eligible.length === 0) {
      out.push({
        id: "no-eligible-products",
        category: "Risk",
        priority: "Critical",
        title: "No catalog products survive basic hard filters",
        detail:
          "FICO, LTV, state, or occupancy combination filters out the entire lender catalog. " +
          "Re-check inputs or expand the program catalog for this niche.",
      });
    } else if (eligible.length <= 3) {
      out.push({
        id: "thin-product-shelf",
        category: "Risk",
        priority: "Medium",
        title: `Only ${eligible.length} program(s) survive basic filters`,
        detail: "Thin product shelf — small pricing changes will swing the recommendation. Lock the scenario early.",
        productIds: eligible.slice(0, 5).map((p) => p.id),
      });
    }
  }

  return { suggestions: sortByPriority(out), context: ctx };
}

const PRIORITY_RANK: Record<SuggestionPriority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

function sortByPriority(list: Suggestion[]): Suggestion[] {
  return [...list].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}

function monthsSince(dateStr: string): number {
  const then = new Date(dateStr);
  if (Number.isNaN(then.getTime())) return 0;
  const now = new Date();
  return Math.max(
    0,
    (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth()),
  );
}

/**
 * Dynamic discovery questions that adapt to the borrower scenario.
 * Returned as a flat list with grouping so the UI can render them conversationally.
 */
export interface DiscoveryQuestion {
  id: string;
  group: "Goals" | "Affordability" | "Qualification" | "Strategy" | "Concerns";
  question: string;
  type: "text" | "money" | "number" | "yesno" | "choice";
  options?: string[];
  /** When true, this question gates other recommendations. */
  critical?: boolean;
}

export function buildDiscoveryQuestions(s: BorrowerScenario): DiscoveryQuestion[] {
  const q: DiscoveryQuestion[] = [];

  // Universal
  q.push({
    id: "assets",
    group: "Affordability",
    question: "Total verified liquid assets (checking + savings + non-retirement)?",
    type: "money",
    critical: true,
  });
  q.push({
    id: "reserves_months",
    group: "Qualification",
    question: "How many months of PITI in reserves after closing?",
    type: "number",
  });
  q.push({
    id: "comfort_payment",
    group: "Affordability",
    question: "What total monthly payment feels comfortable?",
    type: "money",
  });

  // Self-employed
  if (s.incomeType === "Self-Employed 1099" || s.incomeType === "Bank Statement") {
    q.push({ id: "se_years", group: "Qualification", question: "How long have you owned the business?", type: "text" });
    q.push({ id: "se_trend", group: "Qualification", question: "Is income increasing, flat, or declining year-over-year?", type: "choice", options: ["Increasing", "Flat", "Declining"] });
    q.push({ id: "se_writeoffs", group: "Qualification", question: "Do you take significant business write-offs?", type: "yesno" });
    q.push({ id: "se_bizbank", group: "Qualification", question: "Do you have 12+ months of business bank statements?", type: "yesno" });
  }

  // First-time buyer
  if (s.specialNeeds.includes("First-Time Buyer")) {
    q.push({ id: "ftb_realtor", group: "Strategy", question: "Have you spoken with a realtor?", type: "yesno" });
    q.push({ id: "ftb_dpa", group: "Strategy", question: "Have you reviewed down payment assistance options?", type: "yesno" });
  }

  // Refinance
  if (s.loanPurpose === "Refinance" || s.loanPurpose === "Cash-Out Refi") {
    q.push({ id: "refi_rate", group: "Goals", question: "Current interest rate?", type: "number" });
    q.push({ id: "refi_balance", group: "Goals", question: "Current mortgage balance?", type: "money" });
    q.push({ id: "refi_goal", group: "Goals", question: "Primary goal?", type: "choice", options: ["Lower payment", "Cash-out", "Remove PMI", "Shorten term", "Consolidate debt"] });
  }

  // Investor
  if (s.occupancy === "Investment") {
    q.push({ id: "inv_rental_type", group: "Strategy", question: "Long-term or short-term rental?", type: "choice", options: ["Long-term", "Short-term", "Mix"] });
    q.push({ id: "inv_portfolio", group: "Strategy", question: "How many investment properties currently owned?", type: "number" });
    q.push({ id: "inv_management", group: "Strategy", question: "Self-managed or property manager?", type: "choice", options: ["Self", "PM"] });
  }

  // Low credit
  if (s.creditScore < 620) {
    q.push({ id: "credit_cause", group: "Concerns", question: "Do you know what caused the credit score to be where it is?", type: "text" });
    q.push({ id: "credit_lates", group: "Concerns", question: "Any late payments in the last 12 months?", type: "yesno" });
    q.push({ id: "credit_collections", group: "Concerns", question: "Any open collections or charge-offs?", type: "yesno" });
    q.push({ id: "credit_repair", group: "Concerns", question: "Actively working on credit repair?", type: "yesno" });
  }

  // VA
  if (s.loanTypePrefs.includes("VA")) {
    q.push({ id: "va_disability", group: "Qualification", question: "VA disability rating (if any)?", type: "text" });
    q.push({ id: "va_existing", group: "Qualification", question: "Existing VA loan?", type: "yesno" });
  }

  return q;
}
