import { normalizeSiteSnapshot } from "@/lib/site-snapshot";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SiteSnapshot } from "@/types/domain";

type ChatPageSite = {
  id: string;
  name: string;
  template_id: string;
  current_version_id: string | null;
};

export async function loadChatPageSnapshot(site: ChatPageSite): Promise<SiteSnapshot> {
  const supabase = createSupabaseAdminClient();

  if (!site.current_version_id) {
    return normalizeSiteSnapshot(null, site);
  }

  const { data: version, error } = await supabase
    .from("site_versions")
    .select("snapshot_json")
    .eq("id", site.current_version_id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeSiteSnapshot(version?.snapshot_json ?? null, site);
}
