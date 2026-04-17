import { supabase } from "@/integrations/supabase/client";
import type { Lender, LenderProduct, IncomeType, PropertyType, Occupancy, LoanType, SpecialNeed } from "./types";
import { seedLenders, seedProducts } from "./seed";
import { store } from "./storage";

// Pull lenders + programs from DB and convert to legacy LenderProduct/Lender shape
// the matching engine + UI already understand. Falls back to local seed if DB empty.
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

    if (dbLenders.length === 0 && dbPrograms.length === 0) {
      // No DB data yet — fall back to seed so the app stays usable
      return { lenders: store.getLenders().length ? store.getLenders() : seedLenders,
               products: store.getProducts().length ? store.getProducts() : seedProducts };
    }

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
