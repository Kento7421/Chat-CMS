import type { Database, Json } from "@/types/database";

export type SnapshotJson = Record<string, Json | undefined>;

export type ChangeSetRow = Database["public"]["Tables"]["change_sets"]["Row"];
export type SiteVersionRow = Database["public"]["Tables"]["site_versions"]["Row"];
export type VersionChangeRow = Database["public"]["Tables"]["version_changes"]["Row"];

export type VersionChangeType = "added" | "removed" | "changed";

export interface VersionDiffEntry {
  path: string[];
  pathLabel: string;
  pageKey: string | null;
  sectionKey: string | null;
  fieldKey: string | null;
  changeType: VersionChangeType;
  beforeValue: Json | null;
  afterValue: Json | null;
  summary: string;
}

export interface PublishableChangeSetPayload {
  basedOnVersionId?: string | null;
  proposedSnapshotJson: SnapshotJson;
}

export interface NewSiteVersionInput {
  client_id: string;
  site_id: string;
  version_number: number;
  parent_version_id: string | null;
  rollback_from_version_id: string | null;
  snapshot_json: Json;
  summary: string | null;
  created_by_user_id: string | null;
  source_change_set_id: string | null;
}

export interface NewVersionChangeInput {
  site_version_id: string;
  page_key: string | null;
  section_key: string | null;
  field_key: string | null;
  change_type: string;
  before_value: Json | null;
  after_value: Json | null;
  summary: string | null;
}

export interface PublishChangeSetResult {
  version: SiteVersionRow;
  diff: VersionDiffEntry[];
}

export interface RollbackToVersionResult {
  version: SiteVersionRow;
  diff: VersionDiffEntry[];
  rolledBackToVersion: SiteVersionRow;
  previousCurrentVersion: SiteVersionRow;
}
