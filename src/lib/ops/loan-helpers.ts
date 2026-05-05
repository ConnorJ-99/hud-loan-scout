import type { Database } from "@/integrations/supabase/types";

export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type LeadSource = Database["public"]["Enums"]["lead_source"];
export type LoanStage = Database["public"]["Enums"]["loan_stage"];
export type CompMode = Database["public"]["Enums"]["comp_mode"];
export type CompPlan = Database["public"]["Enums"]["comp_plan"];
export type FeeRecipientRole = Database["public"]["Enums"]["fee_recipient_role"];
export type FeeDeductFrom = Database["public"]["Enums"]["fee_deduct_from"];
export type ExpenseCategory = Database["public"]["Enums"]["expense_category"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "not_ready", label: "Not Ready" },
  { value: "bad_lead", label: "Bad Lead" },
  { value: "duplicate", label: "Duplicate" },
  { value: "moved_to_tracking", label: "Moved to Tracking" },
];

export const LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: "ghl", label: "GoHighLevel" },
  { value: "zapier", label: "Zapier" },
  { value: "website", label: "Website" },
  { value: "zillow", label: "Zillow" },
  { value: "other", label: "Other" },
];

export const LOAN_STAGES: { value: LoanStage; label: string }[] = [
  { value: "new", label: "New" },
  { value: "application", label: "Application" },
  { value: "processing", label: "Processing" },
  { value: "underwriting", label: "Underwriting" },
  { value: "conditional_approval", label: "Conditional Approval" },
  { value: "clear_to_close", label: "Clear to Close" },
  { value: "funded", label: "Funded" },
  { value: "lost", label: "Lost" },
];

export const ACTIVE_STAGES: LoanStage[] = [
  "new", "application", "processing", "underwriting", "conditional_approval", "clear_to_close",
];
export const PIPELINE_STAGES: LoanStage[] = [...ACTIVE_STAGES, "funded"];

export function formatCurrency(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n ?? 0));
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function leadStatusBadgeClass(status: LeadStatus): string {
  switch (status) {
    case "new": return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    case "contacted": return "bg-purple-500/15 text-purple-300 border-purple-500/30";
    case "not_ready": return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "bad_lead": return "bg-red-500/15 text-red-300 border-red-500/30";
    case "duplicate": return "bg-gray-500/15 text-gray-300 border-gray-500/30";
    case "moved_to_tracking": return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  }
}

export function loanStageBadgeClass(stage: LoanStage): string {
  switch (stage) {
    case "new": return "bg-slate-500/15 text-slate-300";
    case "application": return "bg-blue-500/15 text-blue-300";
    case "processing": return "bg-indigo-500/15 text-indigo-300";
    case "underwriting": return "bg-violet-500/15 text-violet-300";
    case "conditional_approval": return "bg-purple-500/15 text-purple-300";
    case "clear_to_close": return "bg-amber-500/15 text-amber-300";
    case "funded": return "bg-emerald-500/15 text-emerald-300";
    case "lost": return "bg-red-500/15 text-red-300";
  }
}

export function labelFor<T extends string>(list: { value: T; label: string }[], v: T): string {
  return list.find((i) => i.value === v)?.label ?? v;
}

export const COMP_MODES: { value: CompMode; label: string }[] = [
  { value: "percentage", label: "Percentage / Points" },
  { value: "flat", label: "Flat Dollar" },
];

export const COMP_PLANS: { value: CompPlan; label: string }[] = [
  { value: "commission_only", label: "Commission Only" },
  { value: "salary", label: "Salary" },
  { value: "salary_plus_commission", label: "Salary + Commission" },
  { value: "draw_against_commission", label: "Draw Against Commission" },
];

export const FEE_RECIPIENT_ROLES: { value: FeeRecipientRole; label: string }[] = [
  { value: "loan_officer", label: "Loan Officer" },
  { value: "processor", label: "Processor" },
  { value: "assistant", label: "Assistant" },
  { value: "admin", label: "Admin" },
];

export const FEE_DEDUCT_FROM: { value: FeeDeductFrom; label: string }[] = [
  { value: "lo_split", label: "LO Split" },
  { value: "house_split", label: "House Split" },
];

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "payroll", label: "Payroll" },
  { value: "rent", label: "Rent" },
  { value: "marketing", label: "Marketing" },
  { value: "zillow_leads", label: "Zillow Leads" },
  { value: "office", label: "Office" },
  { value: "processing", label: "Processing" },
  { value: "licensing", label: "Licensing" },
  { value: "software", label: "Software" },
  { value: "compliance", label: "Compliance" },
  { value: "advertising", label: "Advertising" },
  { value: "team", label: "Team Expenses" },
  { value: "misc", label: "Miscellaneous" },
];

export type LoanCompInput = {
  loan_amount: number | null;
  comp_mode: CompMode;
  comp_points: number | null;
  comp_flat_amount: number | null;
  gross_commission?: number | null;
  lo_split_pct: number | null;
  house_split_pct: number | null;
};

export type LoanFeeInput = {
  amount_mode: CompMode;
  flat_amount: number | null;
  pct_of_gross: number | null;
  deduct_from: FeeDeductFrom;
};

export type CompBreakdown = {
  grossCommission: number;
  loSplitPctEffective: number;
  houseSplitPctEffective: number;
  loBeforeFees: number;
  houseBeforeFees: number;
  feesFromLo: number;
  feesFromHouse: number;
  totalFees: number;
  loNet: number;
  houseNet: number;
};

export function computeGrossCommission(loan: LoanCompInput): number {
  if (loan.comp_mode === "flat") return Number(loan.comp_flat_amount ?? 0);
  return Number(loan.loan_amount ?? 0) * (Number(loan.comp_points ?? 0) / 100);
}

export function computeFeeAmount(fee: LoanFeeInput, gross: number): number {
  if (fee.amount_mode === "flat") return Number(fee.flat_amount ?? 0);
  return gross * Number(fee.pct_of_gross ?? 0);
}

export function computeBreakdown(loan: LoanCompInput, fees: LoanFeeInput[]): CompBreakdown {
  const grossCommission = computeGrossCommission(loan);
  const loPct = Number(loan.lo_split_pct ?? 0);
  const housePct = Number(loan.house_split_pct ?? 0);
  let feesFromLo = 0, feesFromHouse = 0;
  for (const f of fees) {
    const a = computeFeeAmount(f, grossCommission);
    if (f.deduct_from === "lo_split") feesFromLo += a;
    else feesFromHouse += a;
  }
  const loBefore = grossCommission * loPct;
  const houseBefore = grossCommission * housePct;
  return {
    grossCommission,
    loSplitPctEffective: loPct,
    houseSplitPctEffective: housePct,
    loBeforeFees: loBefore,
    houseBeforeFees: houseBefore,
    feesFromLo, feesFromHouse,
    totalFees: feesFromLo + feesFromHouse,
    loNet: loBefore - feesFromLo,
    houseNet: houseBefore - feesFromHouse,
  };
}
