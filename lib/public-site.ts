export type PublicSiteLookupRow = {
  id: string;
  name: string;
  slug: string;
  template_id: string;
  current_version_id: string | null;
  status: "draft" | "published" | "archived";
};

export function resolvePublicSiteCandidate(
  candidates: PublicSiteLookupRow[]
): PublicSiteLookupRow | null {
  if (candidates.length !== 1) {
    return null;
  }

  const [site] = candidates;

  if (!site || site.status !== "published") {
    return null;
  }

  return site;
}
