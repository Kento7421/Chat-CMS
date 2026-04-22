export { createVersionDiff } from "@/lib/versioning/diff";
export {
  ChangeSetAlreadyAppliedError,
  ChangeSetPayloadError,
  VersionConflictError,
  VersionNotFoundError,
  VersioningError,
  createNextVersionNumber,
  publishSnapshotVersion,
  publishChangeSet,
  rollbackToVersion,
  saveVersionChanges,
  updateSiteCurrentVersion
} from "@/lib/versioning/service";
export { publishableChangeSetPayloadSchema, snapshotJsonSchema } from "@/lib/versioning/schemas";
export { SupabaseVersioningStore } from "@/lib/versioning/supabase-store";
export type { VersioningStore } from "@/lib/versioning/store";
export type {
  NewSiteVersionInput,
  NewVersionChangeInput,
  PublishChangeSetResult,
  PublishableChangeSetPayload,
  RollbackToVersionResult,
  SiteVersionRow,
  SnapshotJson,
  VersionDiffEntry
} from "@/lib/versioning/types";
