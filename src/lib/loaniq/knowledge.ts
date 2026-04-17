import { supabase } from "@/integrations/supabase/client";

export interface ExtractionResult {
  lender: {
    name: string;
    ae_name: string | null;
    ae_email: string | null;
    ae_phone: string | null;
    website: string | null;
    states_licensed: string[];
    reputation_notes: string | null;
    avg_turn_time_days: number | null;
    niche_advantages: string | null;
  };
  programs: Array<{
    product_name: string;
    loan_program: string | null;
    product_type: string | null;
    min_fico: number | null;
    max_ltv: number | null;
    max_dti: number | null;
    reserve_months: number | null;
    occupancies: string[];
    property_types: string[];
    income_types: string[];
    loan_types: string[];
    states: string[];
    min_loan_amount: number | null;
    max_loan_amount: number | null;
    seasoning_months: number | null;
    bk_seasoning_months: number | null;
    fc_seasoning_months: number | null;
    dscr_min: number | null;
    foreign_national_eligible: boolean;
    itin_eligible: boolean;
    dpa_available: boolean;
    dpa_min_fico: number | null;
    gift_funds_allowed: boolean;
    exception_policy: string | null;
    niche_advantages: string | null;
    competitive_advantages: string | null;
    special_programs: string[];
    notes: string | null;
    tags: string[];
  }>;
  overlays: Array<{
    overlay_type: string;
    description: string;
    applies_to_program: string | null;
  }>;
  summary: string;
}

export async function extractGuidelines(rawText: string): Promise<ExtractionResult> {
  const { data, error } = await supabase.functions.invoke("loaniq-ai", {
    body: { mode: "extract", rawText },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.extraction as ExtractionResult;
}

export async function commitExtraction(
  extraction: ExtractionResult,
  rawText: string,
  sourceLabel: string,
): Promise<{ lenderId: string; programIds: string[] }> {
  // Upsert lender by name (case-insensitive match)
  const { data: existing } = await supabase
    .from("lenders")
    .select("id")
    .ilike("name", extraction.lender.name)
    .maybeSingle();

  let lenderId: string;
  if (existing) {
    lenderId = existing.id;
    await supabase
      .from("lenders")
      .update({
        ae_name: extraction.lender.ae_name,
        ae_email: extraction.lender.ae_email,
        ae_phone: extraction.lender.ae_phone,
        website: extraction.lender.website,
        states_licensed: extraction.lender.states_licensed,
        reputation_notes: extraction.lender.reputation_notes,
        avg_turn_time_days: extraction.lender.avg_turn_time_days,
        niche_advantages: extraction.lender.niche_advantages,
      })
      .eq("id", lenderId);
  } else {
    const { data: ins, error: insErr } = await supabase
      .from("lenders")
      .insert({
        name: extraction.lender.name,
        ae_name: extraction.lender.ae_name,
        ae_email: extraction.lender.ae_email,
        ae_phone: extraction.lender.ae_phone,
        website: extraction.lender.website,
        states_licensed: extraction.lender.states_licensed,
        reputation_notes: extraction.lender.reputation_notes,
        avg_turn_time_days: extraction.lender.avg_turn_time_days,
        niche_advantages: extraction.lender.niche_advantages,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;
    lenderId = ins.id;
  }

  // Insert programs
  const programIds: string[] = [];
  for (const p of extraction.programs) {
    const { data: prog, error: progErr } = await supabase
      .from("loan_programs")
      .insert({
        lender_id: lenderId,
        product_name: p.product_name,
        loan_program: p.loan_program,
        product_type: p.product_type,
        min_fico: p.min_fico,
        max_ltv: p.max_ltv,
        max_dti: p.max_dti,
        reserve_months: p.reserve_months,
        occupancies: p.occupancies,
        property_types: p.property_types,
        income_types: p.income_types,
        loan_types: p.loan_types,
        states: p.states,
        min_loan_amount: p.min_loan_amount,
        max_loan_amount: p.max_loan_amount,
        seasoning_months: p.seasoning_months,
        bk_seasoning_months: p.bk_seasoning_months,
        fc_seasoning_months: p.fc_seasoning_months,
        dscr_min: p.dscr_min,
        foreign_national_eligible: p.foreign_national_eligible,
        itin_eligible: p.itin_eligible,
        dpa_available: p.dpa_available,
        dpa_min_fico: p.dpa_min_fico,
        gift_funds_allowed: p.gift_funds_allowed,
        exception_policy: p.exception_policy,
        niche_advantages: p.niche_advantages,
        competitive_advantages: p.competitive_advantages,
        special_programs: p.special_programs,
        notes: p.notes,
        tags: p.tags,
      })
      .select("id")
      .single();
    if (progErr) throw progErr;
    programIds.push(prog.id);
  }

  // Insert overlays
  for (const o of extraction.overlays) {
    await supabase.from("overlays").insert({
      lender_id: lenderId,
      overlay_type: o.overlay_type,
      description: o.description,
    });
  }

  // Save raw intel record
  await supabase.from("raw_intel").insert({
    source_label: sourceLabel,
    raw_text: rawText,
    extraction: extraction as unknown as Record<string, unknown>,
    status: "committed",
    lender_id: lenderId,
  });

  return { lenderId, programIds };
}
