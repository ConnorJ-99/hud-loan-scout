import { supabase } from "@/integrations/supabase/client";
import type { BorrowerScenario, Lender, LenderProduct } from "./types";

interface CatalogPayload {
  lenders: Lender[];
  products: LenderProduct[];
}

export async function askJarvis(query: string, catalog: CatalogPayload): Promise<string> {
  const { data, error } = await supabase.functions.invoke("loaniq-ai", {
    body: { mode: "query", query, catalog },
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
