import { supabase } from "@/integrations/supabase/client";
import type { BorrowerScenario, ChatMessage, Lender, LenderProduct } from "./types";

interface CatalogPayload {
  lenders: Lender[];
  products: LenderProduct[];
}

export async function askJarvis(
  messages: ChatMessage[],
  catalog: CatalogPayload,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("loaniq-ai", {
    body: { mode: "query", messages, catalog },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.content as string) ?? "";
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
