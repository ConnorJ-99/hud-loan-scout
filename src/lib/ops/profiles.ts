import { supabase } from "@/integrations/supabase/client";

export type StaffProfile = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  display_name: string | null;
  default_comp_pct?: number | null;
  default_lo_split_pct?: number | null;
  default_house_split_pct?: number | null;
  comp_plan?: string | null;
  monthly_salary?: number | null;
  monthly_draw?: number | null;
};

export async function fetchStaffProfiles(extra: string = ""): Promise<StaffProfile[]> {
  const cols = `user_id, full_name, email, display_name, default_comp_pct, default_lo_split_pct, default_house_split_pct${extra ? "," + extra : ""}`;
  const { data } = await supabase.from("profiles").select(cols);
  return (data ?? []) as unknown as StaffProfile[];
}

export function staffName(p: StaffProfile | undefined | null): string {
  if (!p) return "—";
  return p.full_name || p.display_name || p.email || "Unknown";
}

export function findStaffByUserId(list: StaffProfile[], userId: string | null | undefined): StaffProfile | undefined {
  if (!userId) return undefined;
  return list.find((p) => p.user_id === userId);
}

export function staffNameByUserId(list: StaffProfile[], userId: string | null | undefined): string {
  if (!userId) return "—";
  return staffName(findStaffByUserId(list, userId));
}
