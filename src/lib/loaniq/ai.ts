import { supabase } from "@/integrations/supabase/client";
import type { BorrowerScenario, ChatMessage, Lender, LenderProduct } from "./types";

interface CatalogPayload {
  lenders: Lender[];
  products: LenderProduct[];
}

export interface JarvisResponse {
  content: string;
  matchedProductIds: string[];
}

export async function askJarvis(
  messages: ChatMessage[],
  catalog: CatalogPayload,
): Promise<JarvisResponse> {
  const { data, error } = await supabase.functions.invoke("loaniq-ai", {
    body: { mode: "query", messages, catalog },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return {
    content: (data?.content as string) ?? "",
    matchedProductIds: (data?.matchedProductIds as string[]) ?? [],
  };
}

export async function analyzeScenario(
  scenario: BorrowerScenario,
  catalog: CatalogPayload,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("loaniq-ai", {
    body: { mode: "scenario", scenario, catalog },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.content as string) ?? "";
}

export async function polishPrequalNarrative(
  scenario: BorrowerScenario,
  findings: unknown,
  catalog: CatalogPayload,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("loaniq-ai", {
    body: { mode: "prequal", scenario, findings, catalog },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.content as string) ?? "";
}

export interface NoteResult {
  lender_name: string;
  note_summary: string;
  tags_to_add: string[];
  programs_affected: Array<{
    product_id: string;
    add_to_tags: string[];
    add_to_notes: string | null;
    add_to_competitive_advantages: string | null;
  }>;
}

export async function processLenderNote(
  noteText: string,
  catalog: CatalogPayload,
): Promise<NoteResult> {
  const { data, error } = await supabase.functions.invoke("loaniq-ai", {
    body: { mode: "note", noteText, catalog },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.noteResult as NoteResult;
}
