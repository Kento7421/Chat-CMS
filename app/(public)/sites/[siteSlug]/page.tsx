import { notFound } from "next/navigation";
import { SiteBrowserPreview } from "@/components/site-renderer/site-browser-preview";
import { resolvePublicSiteCandidate } from "@/lib/public-site";
import { normalizeSiteSnapshot } from "@/lib/site-snapshot";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PublicSitePageProps = {
  params: Promise<{
    siteSlug: string;
  }>;
};

export default async function PublicSitePage({ params }: PublicSitePageProps) {
  const routeParams = await params;
  const supabase = createSupabaseAdminClient();
  const { data: sites, error } = await supabase
    .from("sites")
    .select("id, name, slug, template_id, current_version_id, status")
    .eq("slug", routeParams.siteSlug)
    .eq("status", "published")
    .limit(2);

  if (error) {
    notFound();
  }

  const site = resolvePublicSiteCandidate(sites ?? []);

  if (!site) {
    notFound();
  }

  let snapshotJson = null;

  if (site.current_version_id) {
    const { data: currentVersion } = await supabase
      .from("site_versions")
      .select("snapshot_json")
      .eq("id", site.current_version_id)
      .maybeSingle();

    snapshotJson = currentVersion?.snapshot_json ?? null;
  }

  const snapshot = normalizeSiteSnapshot(snapshotJson, site);

  return (
    <SiteBrowserPreview snapshot={snapshot} addressLabel={`/sites/${site.slug}`} />
  );
}
