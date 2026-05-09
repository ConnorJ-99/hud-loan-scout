export type IncomeType = "W2" | "Self-Employed 1099" | "Bank Statement" | "DSCR/No-Doc" | "Retired/Asset Depletion";
export type LoanPurpose = "Purchase" | "Refinance" | "Cash-Out Refi";
export type PropertyType = "SFR" | "Condo" | "2-4 Unit" | "5+ Unit Multifamily" | "Mixed Use" | "Commercial";
export type Occupancy = "Primary" | "Second Home" | "Investment";
export type LoanType = "FHA" | "VA" | "USDA" | "Conventional" | "Jumbo" | "Non-QM" | "DSCR" | "Hard Money" | "Bridge";
export type LoanTerm = "15yr" | "20yr" | "30yr" | "40yr" | "IO";
export type SpecialNeed = "Gift funds" | "Co-borrower" | "Foreign National" | "ITIN" | "First-Time Buyer" | "Manufactured Home";

export interface BorrowerScenario {
  nickname?: string;
  creditScore: number;
  incomeType: IncomeType;
  monthlyIncome: number;
  monthlyDebt: number;
  employmentHistory: "2+ years" | "1-2 years" | "Less than 1 year" | "Not applicable";
  hasBankruptcy: boolean;
  bankruptcyDate?: string;
  hasForeclosure: boolean;
  foreclosureDate?: string;

  loanPurpose: LoanPurpose;
  propertyType: PropertyType;
  occupancy: Occupancy;
  state: string;
  propertyValue: number;
  loanAmount: number;
  downPaymentPct: number;

  loanTypePrefs: LoanType[];
  needsDPA: boolean;
  maxRate?: number;
  preferredTerms: LoanTerm[];
  specialNeeds: SpecialNeed[];
}

export interface LenderProduct {
  id: string;
  lenderId: string;
  productName: string;
  productType?: string; // e.g. "Agency", "Non-QM", "Hard Money", etc.
  minFico: number;
  maxLtv: number;
  maxDti: number;
  incomeTypesAllowed: IncomeType[];
  propertyTypesAllowed: PropertyType[];
  loanTypes: LoanType[];
  dpaAvailable: boolean;
  dpaMinFico?: number;
  giftFundsAllowed: boolean;
  occupancies: Occupancy[];
  states: string[]; // "ALL" or specific
  specialPrograms: SpecialNeed[];
  notes: string;
  tags: string[];
  brokerBrief?: string;
  aiTriggers?: string[];
}

export interface Lender {
  id: string;
  name: string;
  aeName?: string;
  aeEmail?: string;
  aePhone?: string;
  website?: string;
  statesLicensed: string[]; // "ALL" or specific
}

export interface MatchResult {
  productId: string;
  matchScore: number;
  status: "STRONG MATCH" | "POSSIBLE MATCH" | "CONDITIONAL MATCH" | "FILTERED";
  highlights: string[];
  caveats: string[];
}

export interface ScenarioHistoryEntry {
  id: string;
  timestamp: number;
  nickname: string;
  scenario: BorrowerScenario;
  topLender?: string;
  topProduct?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
