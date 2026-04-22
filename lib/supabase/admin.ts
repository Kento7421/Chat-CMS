import { createClient } from "@supabase/supabase-js";
import { getServerEnv, getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function createSupabaseAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const { supabaseUrl } = getSupabaseEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  adminClient = createClient<Database>(supabaseUrl, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return adminClient;
}
