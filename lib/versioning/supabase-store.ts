import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { VersioningStore } from "@/lib/versioning/store";
import type { NewSiteVersionInput, NewVersionChangeInput } from "@/lib/versioning/types";

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

  async updateChangeSet(
    changeSetId: string,
    patch: Partial<Database["public"]["Tables"]["change_sets"]["Row"]>
  ) {
    const { data, error } = await this.supabase
      .from("change_sets")
      .update(patch)
      .eq("id", changeSetId)
      .select("*")
      .single();

    return ensureData(data, error, "Updated change set was not returned.");
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
