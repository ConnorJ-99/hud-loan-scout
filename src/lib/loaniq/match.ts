import type { BorrowerScenario, IncomeType, LenderProduct, MatchResult } from "./types";

/**
 * Maps borrower income types to all DB income_type values that should match.
 * The DB may store "Full Doc", "1099", "DSCR", etc.
 */
function incomeTypeMatches(borrowerType: IncomeType, productTypes: string[]): boolean {
  // If product allows everything / has an empty filter, treat as match
  if (productTypes.length === 0) return true;

  // Normalize for comparison
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
      return normalized.some((t) =>
        t === "asset depletion" || t === "asset based" || t === "retired" || t === "retirement" ||
        t === "retired/asset depletion" || t === "full doc"
      );
    default:
      return normalized.some((t) => t === borrowerType.toLowerCase());
  }
}

export function scoreProduct(s: BorrowerScenario, p: LenderProduct): MatchResult | null {
  const dti = s.monthlyIncome > 0 ? (s.monthlyDebt / s.monthlyIncome) * 100 : 0;
  const ltv = s.propertyValue > 0 ? (s.loanAmount / s.propertyValue) * 100 : 0;
  const highlights: string[] = [];
  const caveats: string[] = [];
  let score = 100;

  // Hard filters
  if (s.creditScore < p.minFico && !(p.dpaAvailable && s.needsDPA && p.dpaMinFico && s.creditScore >= p.dpaMinFico)) {
    return null;
  }
  if (ltv > p.maxLtv + 0.01) return null;
  if (p.maxDti > 0 && dti > p.maxDti + 0.5) return null;
  if (p.occupancies.length > 0 && !p.occupancies.includes(s.occupancy)) return null;
  if (p.propertyTypesAllowed.length > 0 && !p.propertyTypesAllowed.includes(s.propertyType)) return null;
  if (!incomeTypeMatches(s.incomeType, p.incomeTypesAllowed)) return null;
  if (p.states.length > 0 && !(p.states.includes("ALL") || p.states.includes(s.state))) return null;

  // Loan type alignment
  if (s.loanTypePrefs.length > 0) {
    const overlap = p.loanTypes.some((t) => s.loanTypePrefs.includes(t));
    if (!overlap) score -= 15;
    else highlights.push(`Supports ${p.loanTypes.filter((t) => s.loanTypePrefs.includes(t)).join(", ")}`);
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

  const dtiBuffer = p.maxDti - dti;
  if (dtiBuffer >= 10) score += 3;
  if (dtiBuffer < 2 && dti > 0) caveats.push(`DTI ${dti.toFixed(1)}% near max ${p.maxDti}%`);

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
