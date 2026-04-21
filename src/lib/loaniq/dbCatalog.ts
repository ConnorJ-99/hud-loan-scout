import { supabase } from "@/integrations/supabase/client";
import type { Lender, LenderProduct, IncomeType, PropertyType, Occupancy, LoanType, SpecialNeed } from "./types";

/**
 * Infer a sensible default max DTI when the DB value is NULL,
 * based on the loan types stored on the program.
 */
function inferDefaultDti(loanTypes: string[]): number {
  const lt = loanTypes.map((t) => t.toLowerCase());
  if (lt.some((t) => t.includes("dscr") || t.includes("hard money") || t.includes("bridge"))) return 0; // N/A
  if (lt.some((t) => t.includes("fha"))) return 56.9;
  if (lt.some((t) => t.includes("va"))) return 60;
  if (lt.some((t) => t.includes("usda"))) return 41;
  // Conventional / Jumbo / generic
  return 50;
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
      const maxDti = dtiFromDb ?? inferDefaultDti(rawLoanTypes);

      return {
        id: p.id,
        lenderId: p.lender_id,
        productName: p.product_name,
        productType: (p.product_type as string) ?? undefined,
        minFico: p.min_fico ?? 0,
        maxLtv: Number(p.max_ltv ?? 0),
        maxDti,
        incomeTypesAllowed: (p.income_types as IncomeType[]) ?? [],
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
      };
    });

    return { lenders, products };
  } catch (e) {
    console.error("loadCatalogFromDb failed", e);
    throw e;
  }
}
