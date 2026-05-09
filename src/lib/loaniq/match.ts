import type { BorrowerScenario, IncomeType, LenderProduct, LoanType, MatchResult } from "./types";

/**
 * Maps borrower income types to all DB income_type values that should match.
 */
function incomeTypeMatches(borrowerType: IncomeType, productTypes: string[]): boolean {
  if (productTypes.length === 0) return true;
  const normalized = productTypes.map((t) => t.toLowerCase().trim());

  switch (borrowerType) {
    case "W2":
      return normalized.some((t) =>
        t === "w2" || t === "full doc" || t === "full documentation" || t === "w-2" ||
        t === "wage earner" || t === "salaried" || t === "traditional"
      );
    case "Self-Employed 1099":
      return normalized.some((t) =>
        t === "1099" || t === "self-employed" || t === "self employed" || t === "full doc" ||
        t === "full documentation" || t === "self-employed 1099" || t === "self employed 1099" ||
        t === "p&l" || t === "sole proprietor"
      );
    case "Bank Statement":
      return normalized.some((t) =>
        t === "bank statement" || t === "bank statements" || t === "bank stmt" || t === "alt doc"
      );
    case "DSCR/No-Doc":
      return normalized.some((t) =>
        t === "dscr" || t === "no-doc" || t === "no doc" || t === "dscr/no-doc" || t === "no income"
      );
    case "Retired/Asset Depletion":
      return normalized.some((t: string) =>
        t === "asset depletion" || t === "asset based" || t === "retired" || t === "retirement" ||
        t === "retired/asset depletion" || t === "full doc"
      );
    default: {
      const bt = borrowerType as string;
      return normalized.some((t) => t === bt.toLowerCase());
    }
  }
}

/** Check if a product is a renovation/rehab product by name */
function isRehabProduct(p: LenderProduct): boolean {
  const name = p.productName.toLowerCase();
  return name.includes("203(k)") || name.includes("203k") || name.includes("renovation") || name.includes("rehab");
}

/**
 * Hard-filter: does the product match the borrower's loan type preferences?
 */
function loanTypeMatchesHard(prefs: LoanType[], product: LenderProduct): boolean {
  if (prefs.length === 0) return true;

  const productLoanTypesLower = product.loanTypes.map((t) => t.toLowerCase());
  const productTypeLower = (product.productType ?? "").toLowerCase();

  for (const pref of prefs) {
    const prefLower = pref.toLowerCase();

    switch (pref) {
      case "Hard Money":
        if (productLoanTypesLower.some((t) => t.includes("hard money")) || productTypeLower.includes("hard money"))
          return true;
        break;
      case "Bridge":
        if (productLoanTypesLower.some((t) => t.includes("bridge")) || productTypeLower.includes("bridge"))
          return true;
        break;
      case "DSCR":
        if (productLoanTypesLower.some((t) => t.includes("dscr")) || productTypeLower.includes("dscr"))
          return true;
        break;
      case "Non-QM":
        if (productTypeLower.includes("non-qm") || productTypeLower.includes("nonqm") ||
            productLoanTypesLower.some((t) => t.includes("non-qm") || t.includes("bank statement") || t.includes("dscr")))
          return true;
        break;
      case "Conventional":
        if (productLoanTypesLower.some((t) => t === "conventional" || t === "full doc") &&
            !productTypeLower.includes("non-qm") && !productTypeLower.includes("hard money"))
          return true;
        break;
      case "FHA":
        if (productLoanTypesLower.some((t) => t === "fha")) return true;
        break;
      case "VA":
        if (productLoanTypesLower.some((t) => t === "va")) return true;
        break;
      case "USDA":
        if (productLoanTypesLower.some((t) => t === "usda")) return true;
        break;
      case "Jumbo":
        if (productLoanTypesLower.some((t) => t === "jumbo") || productTypeLower.includes("jumbo"))
          return true;
        break;
      default:
        if (productLoanTypesLower.some((t) => t === prefLower)) return true;
        break;
    }
  }
  return false;
}

export type FilterReason =
  | "loan_type_mismatch"
  | "rehab_excluded"
  | "fico_too_low"
  | "ltv_too_high"
  | "dti_exceeded"
  | "occupancy_mismatch"
  | "property_type_mismatch"
  | "income_type_mismatch"
  | "state_not_covered"
  | "dpa_required_unavailable";

export interface DebugMatchResult extends MatchResult {
  filterReason?: FilterReason;
  filterDetail?: string;
}

export function scoreProduct(
  s: BorrowerScenario,
  p: LenderProduct,
  debug = false,
): DebugMatchResult | null {
  const dti = s.monthlyIncome > 0 ? (s.monthlyDebt / s.monthlyIncome) * 100 : 0;
  const ltv = s.propertyValue > 0 ? (s.loanAmount / s.propertyValue) * 100 : 0;
  const highlights: string[] = [];
  const caveats: string[] = [];
  let score = 100;

  const filtered = (reason: FilterReason, detail: string): DebugMatchResult | null => {
    if (!debug) return null;
    return {
      productId: p.id,
      matchScore: 0,
      status: "FILTERED" as MatchResult["status"],
      highlights: [],
      caveats: [],
      filterReason: reason,
      filterDetail: detail,
    };
  };

  // --- Hard filters ---
  if (s.loanTypePrefs.length > 0 && !loanTypeMatchesHard(s.loanTypePrefs, p)) {
    return filtered("loan_type_mismatch", `Borrower wants ${s.loanTypePrefs.join("/")}, product offers ${p.loanTypes.join("/") || p.productType || "—"}`);
  }
  if (isRehabProduct(p) && !s.specialNeeds.some((n) => n.toLowerCase().includes("rehab") || n.toLowerCase().includes("renovation"))) {
    return filtered("rehab_excluded", `Rehab product excluded — borrower didn't request rehab/renovation`);
  }
  // DPA: hard-filter when borrower needs DPA and product doesn't offer it
  if (s.needsDPA && !p.dpaAvailable) {
    return filtered("dpa_required_unavailable", `Borrower needs DPA but product has no DPA program`);
  }
  if (s.creditScore < p.minFico && !(p.dpaAvailable && s.needsDPA && p.dpaMinFico && s.creditScore >= p.dpaMinFico)) {
    return filtered("fico_too_low", `FICO ${s.creditScore} < min ${p.minFico}`);
  }
  const dpaCoversLtv = s.needsDPA && p.dpaAvailable;
  if (!dpaCoversLtv && ltv > p.maxLtv + 0.01) {
    return filtered("ltv_too_high", `LTV ${ltv.toFixed(1)}% > max ${p.maxLtv}%`);
  }
  if (dpaCoversLtv && ltv > p.maxLtv) {
    caveats.push(`LTV ${ltv.toFixed(1)}% requires DPA to cover ${(ltv - p.maxLtv).toFixed(1)}% gap`);
  }
  if (p.maxDti > 0 && dti > p.maxDti + 0.5) {
    return filtered("dti_exceeded", `DTI ${dti.toFixed(1)}% > max ${p.maxDti}%`);
  }
  if (p.occupancies.length > 0 && !p.occupancies.includes(s.occupancy)) {
    return filtered("occupancy_mismatch", `Occupancy ${s.occupancy} not in [${p.occupancies.join(", ")}]`);
  }
  if (p.propertyTypesAllowed.length > 0 && !p.propertyTypesAllowed.includes(s.propertyType)) {
    return filtered("property_type_mismatch", `Property ${s.propertyType} not in [${p.propertyTypesAllowed.join(", ")}]`);
  }
  if (!incomeTypeMatches(s.incomeType, p.incomeTypesAllowed)) {
    return filtered("income_type_mismatch", `Income type ${s.incomeType} not in [${p.incomeTypesAllowed.join(", ") || "—"}]`);
  }
  if (p.states.length > 0 && !(p.states.includes("ALL") || p.states.includes(s.state))) {
    return filtered("state_not_covered", `${s.state} not in product's licensed states`);
  }

  // --- Scoring ---
  if (s.loanTypePrefs.length > 0) {
    const overlap = p.loanTypes.some((t) => s.loanTypePrefs.includes(t));
    if (overlap) highlights.push(`Supports ${p.loanTypes.filter((t) => s.loanTypePrefs.includes(t)).join(", ")}`);
  }

  if (s.needsDPA && p.dpaAvailable) {
    highlights.push(p.dpaMinFico ? `DPA available down to ${p.dpaMinFico} FICO` : "DPA available");
    if (p.dpaMinFico && s.creditScore < p.dpaMinFico) caveats.push(`DPA minimum FICO is ${p.dpaMinFico}, borrower at ${s.creditScore}`);
  }

  if (s.specialNeeds.includes("Gift funds") && !p.giftFundsAllowed) {
    score -= 20;
    caveats.push("Gift funds not allowed");
  }

  for (const need of s.specialNeeds) {
    if (p.specialPrograms.includes(need)) highlights.push(`${need} supported`);
  }

  if (s.hasBankruptcy) caveats.push("Bankruptcy on file — verify seasoning per product");
  if (s.hasForeclosure) caveats.push("Foreclosure on file — verify seasoning per product");

  const ficoBuffer = s.creditScore - p.minFico;
  if (ficoBuffer >= 60) score += 5;
  else if (ficoBuffer < 0) score -= 30;

  const ltvBuffer = p.maxLtv - ltv;
  if (ltvBuffer >= 10) score += 3;
  if (ltvBuffer < 2) caveats.push(`LTV ${ltv.toFixed(1)}% near max ${p.maxLtv}%`);

  if (p.maxDti > 0) {
    const dtiBuffer = p.maxDti - dti;
    if (dtiBuffer >= 10) score += 3;
    if (dtiBuffer < 2 && dti > 0) caveats.push(`DTI ${dti.toFixed(1)}% near max ${p.maxDti}%`);
  }

  score = Math.max(0, Math.min(100, score));
  const status: MatchResult["status"] =
    score >= 80 && caveats.length === 0 ? "STRONG MATCH" :
    score >= 60 ? "POSSIBLE MATCH" : "CONDITIONAL MATCH";

  if (highlights.length === 0) {
    highlights.push(`Min FICO ${p.minFico}`, `Max LTV ${p.maxLtv}%`);
  }

  return { productId: p.id, matchScore: Math.round(score), status, highlights, caveats };
}

export function rankMatches(scenario: BorrowerScenario, products: LenderProduct[]): MatchResult[] {
  return products
    .map((p) => scoreProduct(scenario, p))
    .filter((m): m is MatchResult => m !== null)
    .sort((a, b) => b.matchScore - a.matchScore);
}

/** Run scoring in debug mode — returns BOTH matched and filtered products with reasons. */
export function rankMatchesDebug(
  scenario: BorrowerScenario,
  products: LenderProduct[],
): { matched: DebugMatchResult[]; filtered: DebugMatchResult[] } {
  const all = products
    .map((p) => scoreProduct(scenario, p, true))
    .filter((m): m is DebugMatchResult => m !== null);
  return {
    matched: all.filter((m) => m.status !== "FILTERED").sort((a, b) => b.matchScore - a.matchScore),
    filtered: all.filter((m) => m.status === "FILTERED"),
  };
}
