import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { VersioningStore } from "@/lib/versioning/store";
import type {
  CommitVersionPublicationInput,
  NewSiteVersionInput,
  NewVersionChangeInput
} from "@/lib/versioning/types";
import type { Json } from "@/types/database";

function ensureData<T>(data: T | null, error: { message: string } | null, fallbackMessage: string) {
  if (error) {
    throw new Error(error.message);
  }

  if (data == null) {
    throw new Error(fallbackMessage);
  }

  return data;
}

export class SupabaseVersioningStore implements VersioningStore {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getChangeSetById(changeSetId: string) {
    const { data, error } = await this.supabase
      .from("change_sets")
      .select("*")
      .eq("id", changeSetId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async getCurrentSiteVersion(siteId: string) {
    const { data: site, error: siteError } = await this.supabase
      .from("sites")
      .select("current_version_id")
      .eq("id", siteId)
      .single();

    if (siteError) {
      throw new Error(siteError.message);
    }

    if (!site.current_version_id) {
      return null;
    }

    const { data, error } = await this.supabase
      .from("site_versions")
      .select("*")
      .eq("id", site.current_version_id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async getSiteVersionById(versionId: string) {
    const { data, error } = await this.supabase
      .from("site_versions")
      .select("*")
      .eq("id", versionId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  async commitVersionPublication(input: CommitVersionPublicationInput) {
    const { data, error } = await this.supabase.rpc("commit_site_publication_transaction", {
      p_site_id: input.siteId,
      p_expected_current_version_id: input.expectedCurrentVersionId,
      p_version_payload: input.version as unknown as Json,
      p_diff_entries: input.versionChanges as unknown as Json,
      p_change_set_id: input.changeSetTransition?.id ?? null,
      p_expected_change_set_status: input.changeSetTransition?.expectedStatus ?? null,
      p_change_set_patch: (input.changeSetTransition?.patch ?? null) as Json | null,
      p_news_post_payload: (input.newsPost ?? null) as Json | null,
      p_audit_log_payload: (input.auditLog ?? null) as Json | null
    });

    return {
      version: ensureData(data, error, "Committed site version was not returned."),
      newsPost: null,
      auditLog: null
    };
  }

  async insertSiteVersion(input: NewSiteVersionInput) {
    const { data, error } = await this.supabase
      .from("site_versions")
      .insert(input)
      .select("*")
      .single();

    return ensureData(data, error, "Inserted site version was not returned.");
  }

  async insertVersionChanges(changes: NewVersionChangeInput[]) {
    if (changes.length === 0) {
      return;
    }

    const { error } = await this.supabase.from("version_changes").insert(changes);

    if (error) {
      throw new Error(error.message);
    }
  }

  async updateSiteCurrentVersion(siteId: string, versionId: string) {
    const { error } = await this.supabase
      .from("sites")
      .update({ current_version_id: versionId })
      .eq("id", siteId);

    if (error) {
      throw new Error(error.message);
    }
  }
}
