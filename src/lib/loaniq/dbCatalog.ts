import { supabase } from "@/integrations/supabase/client";
import type { Lender, LenderProduct, IncomeType, PropertyType, Occupancy, LoanType, SpecialNeed } from "./types";

// Pull lenders + programs from DB and convert to legacy LenderProduct/Lender shape
// the matching engine + UI already understand. Returns empty arrays when DB is empty —
// no silent fallback to seed data.
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

    const products: LenderProduct[] = dbPrograms.map((p) => ({
      id: p.id,
      lenderId: p.lender_id,
      productName: p.product_name,
      minFico: p.min_fico ?? 0,
      maxLtv: Number(p.max_ltv ?? 0),
      maxDti: Number(p.max_dti ?? 0),
      incomeTypesAllowed: (p.income_types as IncomeType[]) ?? [],
      propertyTypesAllowed: (p.property_types as PropertyType[]) ?? [],
      loanTypes: (p.loan_types as LoanType[]) ?? [],
      dpaAvailable: !!p.dpa_available,
      dpaMinFico: p.dpa_min_fico ?? undefined,
      giftFundsAllowed: !!p.gift_funds_allowed,
      occupancies: (p.occupancies as Occupancy[]) ?? [],
      states: (p.states as string[]) ?? [],
      specialPrograms: (p.special_programs as SpecialNeed[]) ?? [],
      notes: p.notes ?? "",
      tags: (p.tags as string[]) ?? [],
    }));

    return { lenders, products };
  } catch (e) {
    console.error("loadCatalogFromDb failed, falling back to seed", e);
    return { lenders: seedLenders, products: seedProducts };
  }
}
