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
        t === "w2" || t === "full doc" || t === "full documentation" || t === "w-2" || t === "wage earner"
      );
    case "Self-Employed 1099":
      return normalized.some((t) =>
        t === "1099" || t === "self-employed" || t === "self employed" || t === "full doc" ||
        t === "full documentation" || t === "self-employed 1099" || t === "p&l"
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
 * Returns false if the product should be excluded.
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
        if (productLoanTypesLower.some((t) => t === "fha"))
          return true;
        break;
      case "VA":
        if (productLoanTypesLower.some((t) => t === "va"))
          return true;
        break;
      case "USDA":
        if (productLoanTypesLower.some((t) => t === "usda"))
          return true;
        break;
      case "Jumbo":
        if (productLoanTypesLower.some((t) => t === "jumbo") || productTypeLower.includes("jumbo"))
          return true;
        break;
      default:
        if (productLoanTypesLower.some((t) => t === prefLower))
          return true;
        break;
    }
  }
  return false;
}

export function scoreProduct(s: BorrowerScenario, p: LenderProduct): MatchResult | null {
  const dti = s.monthlyIncome > 0 ? (s.monthlyDebt / s.monthlyIncome) * 100 : 0;
  const ltv = s.propertyValue > 0 ? (s.loanAmount / s.propertyValue) * 100 : 0;
  const highlights: string[] = [];
  const caveats: string[] = [];
  let score = 100;

  // --- Hard filters ---

  // Loan type prefs are a HARD filter
  if (s.loanTypePrefs.length > 0 && !loanTypeMatchesHard(s.loanTypePrefs, p)) {
    return null;
  }

  // Exclude rehab/renovation products unless borrower explicitly wants them
  if (isRehabProduct(p) && !s.specialNeeds.some((n) => n.toLowerCase().includes("rehab") || n.toLowerCase().includes("renovation"))) {
    // Also allow if loan type prefs are empty (show everything) — no, exclude by default
    return null;
  }

  // FICO
  if (s.creditScore < p.minFico && !(p.dpaAvailable && s.needsDPA && p.dpaMinFico && s.creditScore >= p.dpaMinFico)) {
    return null;
  }
  // LTV
  const dpaCoversLtv = s.needsDPA && p.dpaAvailable;
  if (!dpaCoversLtv && ltv > p.maxLtv + 0.01) return null;
  if (dpaCoversLtv && ltv > p.maxLtv) {
    caveats.push(`LTV ${ltv.toFixed(1)}% requires DPA to cover ${(ltv - p.maxLtv).toFixed(1)}% gap`);
  }
  // DTI (skip if maxDti === 0 meaning N/A for DSCR etc.)
  if (p.maxDti > 0 && dti > p.maxDti + 0.5) return null;
  // Occupancy
  if (p.occupancies.length > 0 && !p.occupancies.includes(s.occupancy)) return null;
  // Property type
  if (p.propertyTypesAllowed.length > 0 && !p.propertyTypesAllowed.includes(s.propertyType)) return null;
  // Income type
  if (!incomeTypeMatches(s.incomeType, p.incomeTypesAllowed)) return null;
  // State
  if (p.states.length > 0 && !(p.states.includes("ALL") || p.states.includes(s.state))) return null;

  // --- Scoring ---

  // Loan type alignment bonus
  if (s.loanTypePrefs.length > 0) {
    const overlap = p.loanTypes.some((t) => s.loanTypePrefs.includes(t));
    if (overlap) highlights.push(`Supports ${p.loanTypes.filter((t) => s.loanTypePrefs.includes(t)).join(", ")}`);
  }

  // DPA need
  if (s.needsDPA) {
    if (p.dpaAvailable) {
      highlights.push(p.dpaMinFico ? `DPA available down to ${p.dpaMinFico} FICO` : "DPA available");
      if (p.dpaMinFico && s.creditScore < p.dpaMinFico) caveats.push(`DPA minimum FICO is ${p.dpaMinFico}, borrower at ${s.creditScore}`);
    } else {
      score -= 25;
      caveats.push("No DPA program on this product");
    }
  }

  // Gift funds
  if (s.specialNeeds.includes("Gift funds") && !p.giftFundsAllowed) {
    score -= 20;
    caveats.push("Gift funds not allowed");
  }

  // Special programs
  for (const need of s.specialNeeds) {
    if (p.specialPrograms.includes(need)) highlights.push(`${need} supported`);
  }

  // Bankruptcy / foreclosure caveats
  if (s.hasBankruptcy) caveats.push("Bankruptcy on file — verify seasoning per product");
  if (s.hasForeclosure) caveats.push("Foreclosure on file — verify seasoning per product");

  // Buffer scoring
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
