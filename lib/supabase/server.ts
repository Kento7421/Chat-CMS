import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

type CookieWrite = {
  name: string;
  value: string;
  options?: Parameters<CookieStore["set"]>[2];
};

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieWrite[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components から呼ばれた場合は cookie の書き込みをスキップする。
        }
      }
    }
  }) as ReturnType<typeof createServerClient<Database>>;
}
