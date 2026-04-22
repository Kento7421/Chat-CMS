import { isDeepStrictEqual } from "node:util";
import type { Json } from "@/types/database";
import type { SnapshotJson, VersionChangeType, VersionDiffEntry } from "@/lib/versioning/types";

function isPlainObject(value: Json | undefined): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatPathLabel(path: string[]) {
  if (path.length === 0) {
    return "root";
  }

  return path.reduce((label, segment) => {
    if (/^\d+$/.test(segment)) {
      return `${label}[${segment}]`;
    }

    return label ? `${label}.${segment}` : segment;
  }, "");
}

function inferPathKeys(path: string[]) {
  const namedSegments = path.filter((segment) => !/^\d+$/.test(segment));

  return {
    pageKey: namedSegments[0] ?? null,
    sectionKey: namedSegments[1] ?? null,
    fieldKey: namedSegments.at(-1) ?? null
  };
}

function toChangeType(beforeValue: Json | undefined, afterValue: Json | undefined): VersionChangeType {
  if (typeof beforeValue === "undefined") {
    return "added";
  }

  if (typeof afterValue === "undefined") {
    return "removed";
  }

  return "changed";
}

function toChangeSummary(pathLabel: string, changeType: VersionChangeType) {
  switch (changeType) {
    case "added":
      return `${pathLabel} を追加`;
    case "removed":
      return `${pathLabel} を削除`;
    default:
      return `${pathLabel} を変更`;
  }
}

function walkDiff(
  beforeValue: Json | undefined,
  afterValue: Json | undefined,
  path: string[],
  diffs: VersionDiffEntry[]
) {
  if (isDeepStrictEqual(beforeValue, afterValue)) {
    return;
  }

  if (isPlainObject(beforeValue) && isPlainObject(afterValue)) {
    const keys = [...new Set([...Object.keys(beforeValue), ...Object.keys(afterValue)])].sort();

    keys.forEach((key) => {
      walkDiff(beforeValue[key], afterValue[key], [...path, key], diffs);
    });

    return;
  }

  if (Array.isArray(beforeValue) && Array.isArray(afterValue)) {
    const maxLength = Math.max(beforeValue.length, afterValue.length);

    for (let index = 0; index < maxLength; index += 1) {
      walkDiff(beforeValue[index], afterValue[index], [...path, String(index)], diffs);
    }

    return;
  }

  const pathLabel = formatPathLabel(path);
  const changeType = toChangeType(beforeValue, afterValue);
  const inferredKeys = inferPathKeys(path);

  diffs.push({
    path,
    pathLabel,
    pageKey: inferredKeys.pageKey,
    sectionKey: inferredKeys.sectionKey,
    fieldKey: inferredKeys.fieldKey,
    changeType,
    beforeValue: typeof beforeValue === "undefined" ? null : beforeValue,
    afterValue: typeof afterValue === "undefined" ? null : afterValue,
    summary: toChangeSummary(pathLabel, changeType)
  });
}

export function createVersionDiff(
  previousSnapshot: SnapshotJson | null | undefined,
  nextSnapshot: SnapshotJson
) {
  const diffs: VersionDiffEntry[] = [];

  walkDiff(previousSnapshot ?? {}, nextSnapshot, [], diffs);

  return diffs;
}
