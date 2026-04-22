import { createVersionDiff } from "@/lib/versioning/diff";
import { publishableChangeSetPayloadSchema } from "@/lib/versioning/schemas";
import type { Json } from "@/types/database";
import type { VersioningStore } from "@/lib/versioning/store";
import type {
  PublishChangeSetResult,
  RollbackToVersionResult,
  SnapshotJson,
  SiteVersionRow,
  VersionDiffEntry
} from "@/lib/versioning/types";

export class VersioningError extends Error {}

export class ChangeSetPayloadError extends VersioningError {}

export class ChangeSetAlreadyAppliedError extends VersioningError {}

export class VersionConflictError extends VersioningError {}

export class VersionNotFoundError extends VersioningError {}

type PublishChangeSetInput = {
  changeSetId: string;
  actorUserId?: string | null;
  now?: () => string;
};

type RollbackToVersionInput = {
  siteId: string;
  targetVersionId: string;
  actorUserId?: string | null;
  summary?: string;
};

type PublishSnapshotVersionInput = {
  clientId: string;
  siteId: string;
  snapshot: Json;
  summary: string | null;
  actorUserId?: string | null;
};

function ensureValidCurrentVersionNumber(currentVersionNumber: number | null | undefined) {
  if (currentVersionNumber == null) {
    return;
  }

  if (!Number.isInteger(currentVersionNumber) || currentVersionNumber < 1) {
    throw new VersioningError("Current version number must be a positive integer.");
  }
}

function ensureSiteVersionBelongsToSite(
  version: SiteVersionRow | null,
  siteId: string
): asserts version is SiteVersionRow {
  if (!version || version.site_id !== siteId) {
    throw new VersionNotFoundError("The requested version does not belong to the target site.");
  }
}

function coerceSnapshotJson(value: Json): SnapshotJson {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new VersioningError("Snapshot JSON must be a plain object.");
  }

  return value as SnapshotJson;
}

export function createNextVersionNumber(currentVersionNumber: number | null | undefined) {
  ensureValidCurrentVersionNumber(currentVersionNumber);

  if (currentVersionNumber == null) {
    return 1;
  }

  return currentVersionNumber + 1;
}

export async function saveVersionChanges(
  store: VersioningStore,
  siteVersionId: string,
  diff: VersionDiffEntry[]
) {
  if (diff.length === 0) {
    return;
  }

  await store.insertVersionChanges(
    diff.map((entry) => ({
      site_version_id: siteVersionId,
      page_key: entry.pageKey,
      section_key: entry.sectionKey,
      field_key: entry.fieldKey,
      change_type: entry.changeType,
      before_value: entry.beforeValue,
      after_value: entry.afterValue,
      summary: entry.summary
    }))
  );
}

export async function updateSiteCurrentVersion(
  store: VersioningStore,
  siteId: string,
  siteVersionId: string
) {
  await store.updateSiteCurrentVersion(siteId, siteVersionId);
}

export async function publishChangeSet(
  store: VersioningStore,
  input: PublishChangeSetInput
): Promise<PublishChangeSetResult> {
  const now = input.now ?? (() => new Date().toISOString());
  const changeSet = await store.getChangeSetById(input.changeSetId);

  if (!changeSet) {
    throw new VersioningError("Change set was not found.");
  }

  if (changeSet.status === "applied") {
    throw new ChangeSetAlreadyAppliedError("Change set has already been applied.");
  }

  const payloadResult = publishableChangeSetPayloadSchema.safeParse(changeSet.payload_json);

  if (!payloadResult.success) {
    throw new ChangeSetPayloadError("Change set payload does not include a valid proposed snapshot.");
  }

  const payload = payloadResult.data;
  const currentVersion = await store.getCurrentSiteVersion(changeSet.site_id);

  if (payload.basedOnVersionId) {
    const baseVersion = await store.getSiteVersionById(payload.basedOnVersionId);
    ensureSiteVersionBelongsToSite(baseVersion, changeSet.site_id);

    if (currentVersion && currentVersion.id !== payload.basedOnVersionId) {
      throw new VersionConflictError(
        "Change set was based on an older version and can no longer be published safely."
      );
    }
  }

  const nextVersionNumber = createNextVersionNumber(currentVersion?.version_number);
  const diff = createVersionDiff(
    (currentVersion?.snapshot_json as typeof payload.proposedSnapshotJson | undefined) ?? null,
    payload.proposedSnapshotJson
  );

  const version = await store.insertSiteVersion({
    client_id: changeSet.client_id,
    site_id: changeSet.site_id,
    version_number: nextVersionNumber,
    parent_version_id: currentVersion?.id ?? payload.basedOnVersionId ?? null,
    rollback_from_version_id: null,
    snapshot_json: payload.proposedSnapshotJson,
    summary: changeSet.summary,
    created_by_user_id:
      input.actorUserId ?? changeSet.approved_by_user_id ?? changeSet.requested_by_user_id,
    source_change_set_id: changeSet.id
  });

  await saveVersionChanges(store, version.id, diff);
  await updateSiteCurrentVersion(store, changeSet.site_id, version.id);
  await store.updateChangeSet(changeSet.id, {
    status: "applied",
    applied_at: now()
  });

  return {
    version,
    diff
  };
}

export async function rollbackToVersion(
  store: VersioningStore,
  input: RollbackToVersionInput
): Promise<RollbackToVersionResult> {
  const currentVersion = await store.getCurrentSiteVersion(input.siteId);
  const targetVersion = await store.getSiteVersionById(input.targetVersionId);

  if (!currentVersion) {
    throw new VersioningError("Current site version was not found.");
  }

  ensureSiteVersionBelongsToSite(targetVersion, input.siteId);

  if (currentVersion.id === targetVersion.id) {
    throw new VersionConflictError("The target version is already the current published version.");
  }

  const nextVersionNumber = createNextVersionNumber(currentVersion.version_number);
  const diff = createVersionDiff(
    coerceSnapshotJson(currentVersion.snapshot_json),
    coerceSnapshotJson(targetVersion.snapshot_json)
  );

  const version = await store.insertSiteVersion({
    client_id: currentVersion.client_id,
    site_id: currentVersion.site_id,
    version_number: nextVersionNumber,
    parent_version_id: currentVersion.id,
    rollback_from_version_id: targetVersion.id,
    snapshot_json: targetVersion.snapshot_json,
    summary: input.summary ?? `Version ${targetVersion.version_number} へロールバック`,
    created_by_user_id: input.actorUserId ?? null,
    source_change_set_id: null
  });

  await saveVersionChanges(store, version.id, diff);
  await updateSiteCurrentVersion(store, input.siteId, version.id);

  return {
    version,
    diff,
    rolledBackToVersion: targetVersion,
    previousCurrentVersion: currentVersion
  };
}

export async function publishSnapshotVersion(
  store: VersioningStore,
  input: PublishSnapshotVersionInput
) {
  const currentVersion = await store.getCurrentSiteVersion(input.siteId);
  const nextVersionNumber = createNextVersionNumber(currentVersion?.version_number);
  const diff = createVersionDiff(
    currentVersion ? coerceSnapshotJson(currentVersion.snapshot_json) : null,
    coerceSnapshotJson(input.snapshot)
  );

  const version = await store.insertSiteVersion({
    client_id: input.clientId,
    site_id: input.siteId,
    version_number: nextVersionNumber,
    parent_version_id: currentVersion?.id ?? null,
    rollback_from_version_id: null,
    snapshot_json: input.snapshot,
    summary: input.summary,
    created_by_user_id: input.actorUserId ?? null,
    source_change_set_id: null
  });

  await saveVersionChanges(store, version.id, diff);
  await updateSiteCurrentVersion(store, input.siteId, version.id);

  return {
    version,
    diff
  };
}
