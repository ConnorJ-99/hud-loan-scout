// Buydown calculator math + helpers

export type BuydownType = "1-0" | "2-1" | "3-2-1" | "custom";

export interface BuydownInputs {
  loanAmount: number;
  termYears: number;
  firstPaymentDate: string; // ISO yyyy-mm-dd
  transactionType: "Purchase" | "Refinance";
  baseRatePct: number; // e.g. 6.875
  buydownType: BuydownType;
  customReductions: number[]; // e.g. [3,2,1] in percentage points
  closingCosts: number;
  extraBuydownCost: number;
  sellerCredit: number;
  lenderCredit: number;
  includeMath: boolean;
}

export const DEFAULT_INPUTS: BuydownInputs = {
  loanAmount: 400000,
  termYears: 30,
  firstPaymentDate: new Date(new Date().setMonth(new Date().getMonth() + 1))
    .toISOString()
    .slice(0, 10),
  transactionType: "Purchase",
  baseRatePct: 6.875,
  buydownType: "2-1",
  customReductions: [2, 1],
  closingCosts: 8500,
  extraBuydownCost: 0,
  sellerCredit: 0,
  lenderCredit: 0,
  includeMath: true,
};

export function reductionsFor(t: BuydownType, custom: number[]): number[] {
  switch (t) {
    case "1-0":
      return [1];
    case "2-1":
      return [2, 1];
    case "3-2-1":
      return [3, 2, 1];
    case "custom":
      return custom.filter((n) => Number.isFinite(n) && n > 0);
  }
}

export function monthlyPI(principal: number, annualRatePct: number, termYears: number): number {
  const n = termYears * 12;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  const pow = Math.pow(1 + r, n);
  return (principal * r * pow) / (pow - 1);
}

export interface YearRow {
  year: number;
  ratePct: number;
  monthlyPI: number;
  standardPI: number;
  monthlySavings: number;
  annualSavings: number;
}

export interface BuydownResult {
  standardMonthly: number;
  reductions: number[];
  yearRows: YearRow[];
  totalTempSavings: number;
  year1Savings: number;
  year2Savings: number;
  year3Savings: number;
  monthlySavingsYear1: number;
  savings6mo: number;
  savings9mo: number;
  savings12mo: number;
  blendedRatePct: number;
  buydownPeriodYears: number;
  netBuydownCost: number; // extra cost - credits, capped at 0
  breakEvenMonths: number | null; // null if no upfront cost or never recovers
  staysAheadThroughMonth: number; // last month buydown cumulative is ahead
  tiesAtMonth: number | null;
}

export function calcBuydown(inp: BuydownInputs): BuydownResult {
  const reductions = reductionsFor(inp.buydownType, inp.customReductions);
  const periodYears = reductions.length;
  const standardMonthly = monthlyPI(inp.loanAmount, inp.baseRatePct, inp.termYears);

  const yearRows: YearRow[] = [];
  let cumSavings = 0;
  for (let i = 0; i < periodYears; i++) {
    const ratePct = Math.max(0, inp.baseRatePct - reductions[i]);
    const m = monthlyPI(inp.loanAmount, ratePct, inp.termYears);
    const monthlySavings = standardMonthly - m;
    const annualSavings = monthlySavings * 12;
    cumSavings += annualSavings;
    yearRows.push({
      year: i + 1,
      ratePct,
      monthlyPI: m,
      standardPI: standardMonthly,
      monthlySavings,
      annualSavings,
    });
  }

  const monthlySavingsYear1 = yearRows[0]?.monthlySavings ?? 0;
  const year1Savings = yearRows[0]?.annualSavings ?? 0;
  const year2Savings = yearRows[1]?.annualSavings ?? 0;
  const year3Savings = yearRows[2]?.annualSavings ?? 0;

  // Blended rate = weighted avg of buydown years + remaining term at note rate,
  // but the borrower-friendly "buydown blended rate" is across the buydown period only.
  let weightedRateBuydownPeriod = 0;
  for (let i = 0; i < periodYears; i++) {
    weightedRateBuydownPeriod += Math.max(0, inp.baseRatePct - reductions[i]);
  }
  const blendedRatePct = periodYears > 0 ? weightedRateBuydownPeriod / periodYears : inp.baseRatePct;

  const netBuydownCost = Math.max(0, inp.extraBuydownCost - inp.sellerCredit - inp.lenderCredit);

  // Break-even: months until cumulative monthly savings ≥ net buydown cost
  let breakEvenMonths: number | null = null;
  if (netBuydownCost > 0) {
    let cum = 0;
    for (let m = 1; m <= periodYears * 12; m++) {
      const yearIdx = Math.min(periodYears - 1, Math.floor((m - 1) / 12));
      cum += yearRows[yearIdx].monthlySavings;
      if (cum >= netBuydownCost) {
        breakEvenMonths = m;
        break;
      }
    }
  }

  // Stays ahead: cumulative savings vs standard payments over buydown horizon.
  // Since buydown payments are always ≤ standard, borrower is always ahead through
  // the last buydown month, then ties (no future higher payment).
  const staysAheadThroughMonth = periodYears * 12;
  const tiesAtMonth = staysAheadThroughMonth + 1;

  return {
    standardMonthly,
    reductions,
    yearRows,
    totalTempSavings: cumSavings,
    year1Savings,
    year2Savings,
    year3Savings,
    monthlySavingsYear1,
    savings6mo: monthlySavingsYear1 * 6,
    savings9mo: monthlySavingsYear1 * 9,
    savings12mo: monthlySavingsYear1 * 12,
    blendedRatePct,
    buydownPeriodYears: periodYears,
    netBuydownCost,
    breakEvenMonths,
    staysAheadThroughMonth,
    tiesAtMonth,
  };
}

export const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const fmtUSD2 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export const fmtPct = (n: number) => `${n.toFixed(3)}%`;

export const DISCLAIMER =
  "This calculator is for educational and comparison purposes only. Figures are estimates and are not a loan estimate, commitment to lend, or guarantee of terms. Payments shown are principal and interest only and do not include property taxes, homeowners insurance, HOA dues, mortgage insurance, prepaid items, escrow deposits, or APR. Final terms are subject to credit approval, underwriting, investor guidelines, and market pricing.";
