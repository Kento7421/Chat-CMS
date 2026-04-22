import {
  assertAppUserCanAccessSite,
  listAccessibleSitesForAppUser
} from "@/lib/auth/server";
import type { AppUser } from "@/lib/auth/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rollbackToVersion, SupabaseVersioningStore } from "@/lib/versioning";
import type { RollbackInput } from "@/lib/versions/schemas";

export async function listSiteVersionsForAppUser(appUser: AppUser, siteId?: string) {
  const supabase = createSupabaseAdminClient();
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

  const { data: versions, error: versionsError } = await supabase
    .from("site_versions")
    .select(
      "id,site_id,client_id,version_number,parent_version_id,rollback_from_version_id,summary,created_at"
    )
    .eq("site_id", targetSiteId)
    .order("version_number", { ascending: false });

  if (versionsError) {
    throw new Error(versionsError.message);
  }

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
  const supabase = createSupabaseAdminClient();
  const { data: version, error: versionError } = await supabase
    .from("site_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();

  if (versionError) {
    throw new Error(versionError.message);
  }

  if (!version) {
    throw new Error("Version was not found.");
  }

  const site = await assertAppUserCanAccessSite(appUser, version.site_id);
  const { data: changes, error: changesError } =
    await supabase
      .from("version_changes")
      .select("*")
      .eq("site_version_id", version.id)
      .order("created_at", { ascending: true });

  if (changesError) {
    throw new Error(changesError.message);
  }

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
    actorUserId: appUser.id
  });

  const { error } = await supabase.from("audit_logs").insert({
    client_id: detail.site.client_id,
    site_id: detail.site.id,
    actor_user_id: appUser.id,
    action: "rollback",
    target_type: "site_version",
    target_id: result.version.id,
    metadata: {
      rolledBackToVersionId: result.rolledBackToVersion.id,
      previousCurrentVersionId: result.previousCurrentVersion.id,
      createdVersionId: result.version.id
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  return result;
}
