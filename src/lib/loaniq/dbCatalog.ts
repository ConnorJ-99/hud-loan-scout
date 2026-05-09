import { supabase } from "@/integrations/supabase/client";
import type { Lender, LenderProduct, IncomeType, PropertyType, Occupancy, LoanType, SpecialNeed } from "./types";

/**
 * Infer a sensible default max DTI when the DB value is NULL.
 * Returns null when the loan type doesn't match a known category — in that case
 * the DTI hard filter is skipped entirely instead of defaulting to a strict 50.
 */
function inferDefaultDti(loanTypes: string[]): number | null {
  const lt = loanTypes.map((t) => t.toLowerCase());
  if (lt.some((t) => t.includes("dscr") || t.includes("hard money") || t.includes("bridge"))) return 0; // N/A
  if (lt.some((t) => t.includes("fha"))) return 56.9;
  if (lt.some((t) => t.includes("va"))) return 60;
  if (lt.some((t) => t.includes("usda"))) return 41;
  if (lt.some((t) => t.includes("conventional") || t.includes("jumbo") || t.includes("full doc"))) return 50;
  // Unknown category — skip the DTI hard filter for this product
  return null;
}

export async function loadCatalogFromDb(): Promise<{ lenders: Lender[]; products: LenderProduct[] }> {
  try {
    const [lendersRes, programsRes] = await Promise.all([
      supabase.from("lenders").select("*"),
      supabase.from("loan_programs").select("*"),
    ]);

    if (lendersRes.error || programsRes.error) {
      throw lendersRes.error ?? programsRes.error;
    }

    const dbLenders = lendersRes.data ?? [];
    const dbPrograms = programsRes.data ?? [];

    const lenders: Lender[] = dbLenders.map((l) => ({
      id: l.id,
      name: l.name,
      aeName: l.ae_name ?? undefined,
      aeEmail: l.ae_email ?? undefined,
      aePhone: l.ae_phone ?? undefined,
      website: l.website ?? undefined,
      statesLicensed: (l.states_licensed as string[]) ?? [],
    }));

    const products: LenderProduct[] = dbPrograms.map((p) => {
      const rawLoanTypes = (p.loan_types as string[]) ?? [];
      const dtiFromDb = p.max_dti != null ? Number(p.max_dti) : null;
      const inferred = dtiFromDb ?? inferDefaultDti(rawLoanTypes);
      // 0 means "skip DTI filter" (used by scoreProduct for DSCR/Hard Money/Bridge/unknown).
      const maxDti = inferred ?? 0;

      // --- Data audit warnings ---
      const label = `[catalog audit] ${p.product_name ?? p.id}`;
      if (dtiFromDb == null) {
        console.warn(`${label}: max_dti is NULL — inferred ${maxDti === 0 ? "N/A (skipped)" : maxDti}`);
      }
      if (rawLoanTypes.length === 0) {
        console.warn(`${label}: loan_types is empty — product will not match any loan-type preference`);
      }
      const incomeTypes = (p.income_types as string[]) ?? [];
      if (incomeTypes.length === 0) {
        console.warn(`${label}: income_types is empty — falls through but verify expected docs`);
      }
      const nameLower = (p.product_name ?? "").toLowerCase();
      if (!p.dpa_available && (nameLower.includes("dpa") || nameLower.includes("down payment"))) {
        console.warn(`${label}: name suggests DPA but dpa_available=false — likely bad data`);
      }

      return {
        id: p.id,
        lenderId: p.lender_id,
        productName: p.product_name,
        productType: (p.product_type as string) ?? undefined,
        minFico: p.min_fico ?? 0,
        maxLtv: Number(p.max_ltv ?? 0),
        maxDti,
        incomeTypesAllowed: incomeTypes as IncomeType[],
        propertyTypesAllowed: (p.property_types as PropertyType[]) ?? [],
        loanTypes: rawLoanTypes as LoanType[],
        dpaAvailable: !!p.dpa_available,
        dpaMinFico: p.dpa_min_fico ?? undefined,
        giftFundsAllowed: !!p.gift_funds_allowed,
        occupancies: (p.occupancies as Occupancy[]) ?? [],
        states: (p.states as string[]) ?? [],
        specialPrograms: (p.special_programs as SpecialNeed[]) ?? [],
        notes: p.notes ?? "",
        tags: (p.tags as string[]) ?? [],
        brokerBrief: (p as { broker_brief?: string | null }).broker_brief ?? undefined,
        aiTriggers: ((p as { ai_triggers?: string[] | null }).ai_triggers as string[]) ?? [],
      };
    });

    return { lenders, products };
  } catch (e) {
    console.error("loadCatalogFromDb failed", e);
    throw e;
  }
}
