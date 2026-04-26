import {
  assertAppUserCanAccessSite,
  listAccessibleSitesForAppUser
} from "@/lib/auth/server";
import type { AppUser } from "@/lib/auth/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rollbackToVersion, SupabaseVersioningStore } from "@/lib/versioning";
import type { Database } from "@/types/database";
import type { RollbackInput } from "@/lib/versions/schemas";

type SiteVersionSummaryRow = Pick<
  Database["public"]["Tables"]["site_versions"]["Row"],
  | "id"
  | "site_id"
  | "client_id"
  | "version_number"
  | "parent_version_id"
  | "rollback_from_version_id"
  | "summary"
  | "created_at"
>;

type VersionChangeRow = Database["public"]["Tables"]["version_changes"]["Row"];

export async function listSiteVersionsForAppUser(appUser: AppUser, siteId?: string) {
  const supabase = await createSupabaseServerClient();
  const accessibleSites = await listAccessibleSitesForAppUser(appUser);
  const targetSiteId = siteId ?? accessibleSites[0]?.id;

  if (!targetSiteId) {
    return {
      accessibleSites,
      selectedSiteId: null,
      site: null,
      versions: []
    };
  }

  const site = await assertAppUserCanAccessSite(appUser, targetSiteId);
  const { data, error } = await supabase
    .from("site_versions")
    .select(
      "id,site_id,client_id,version_number,parent_version_id,rollback_from_version_id,summary,created_at"
    )
    .eq("site_id", targetSiteId)
    .order("version_number", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const versions = (data ?? []) as SiteVersionSummaryRow[];

  return {
    accessibleSites,
    selectedSiteId: targetSiteId,
    site,
    versions: versions.map((version) => ({
      ...version,
      isCurrent: version.id === site.current_version_id
    }))
  };
}

export async function getSiteVersionDetailForAppUser(appUser: AppUser, versionId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: versionData, error: versionError } = await supabase
    .from("site_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();

  if (versionError) {
    throw new Error(versionError.message);
  }

  const version = versionData as Database["public"]["Tables"]["site_versions"]["Row"] | null;

  if (!version) {
    throw new Error("Version was not found.");
  }

  const site = await assertAppUserCanAccessSite(appUser, version.site_id);
  const { data: changesData, error: changesError } = await supabase
    .from("version_changes")
    .select("*")
    .eq("site_version_id", version.id)
    .order("created_at", { ascending: true });

  if (changesError) {
    throw new Error(changesError.message);
  }

  const changes = (changesData ?? []) as VersionChangeRow[];

  return {
    site,
    version: {
      ...version,
      isCurrent: version.id === site.current_version_id
    },
    changes
  };
}

export async function executeRollbackForAppUser(appUser: AppUser, input: RollbackInput) {
  const supabase = createSupabaseAdminClient();
  const detail = await getSiteVersionDetailForAppUser(appUser, input.targetVersionId);
  const store = new SupabaseVersioningStore(supabase);
  const result = await rollbackToVersion(store, {
    siteId: detail.site.id,
    targetVersionId: input.targetVersionId,
    actorUserId: appUser.id,
    auditLog: {
      client_id: detail.site.client_id,
      site_id: detail.site.id,
      actor_user_id: appUser.id,
      action: "rollback",
      target_type: "site_version",
      target_id: null,
      metadata: {
        rolledBackToVersionId: detail.version.id,
        previousCurrentVersionId: detail.site.current_version_id,
        requestedTargetVersionId: input.targetVersionId
      }
    }
  });

  return result;
}
