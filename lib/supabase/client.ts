import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/supabase/config";

export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createSupabaseClient(url, anonKey);
}

