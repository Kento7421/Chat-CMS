import { describe, expect, it } from "vitest";
import {
  ChangeSetAlreadyAppliedError,
  VersionConflictError,
  createNextVersionNumber,
  createVersionDiff,
  publishChangeSet,
  rollbackToVersion
} from "../../lib/versioning";
import type { VersioningStore } from "../../lib/versioning";
import type {
  ChangeSetRow,
  NewSiteVersionInput,
  NewVersionChangeInput,
  SiteVersionRow
} from "../../lib/versioning/types";

class InMemoryVersioningStore implements VersioningStore {
  private versionCounter = 100;
  private changeCounter = 100;

  constructor(
    readonly siteId: string,
    readonly currentVersionId: { value: string | null },
    readonly versions: SiteVersionRow[],
    readonly changeSets: ChangeSetRow[],
    readonly savedVersionChanges: Array<NewVersionChangeInput & { id: string }> = []
  ) {}

  async getChangeSetById(changeSetId: string) {
    return this.changeSets.find((changeSet) => changeSet.id === changeSetId) ?? null;
  }

  async updateChangeSet(changeSetId: string, patch: Partial<ChangeSetRow>) {
    const changeSet = this.changeSets.find((item) => item.id === changeSetId);

    if (!changeSet) {
      throw new Error("Change set not found");
    }

    Object.assign(changeSet, patch);
    return changeSet;
  }

  async getCurrentSiteVersion(siteId: string) {
    if (siteId !== this.siteId || !this.currentVersionId.value) {
      return null;
    }

    return this.versions.find((version) => version.id === this.currentVersionId.value) ?? null;
  }

  async getSiteVersionById(versionId: string) {
    return this.versions.find((version) => version.id === versionId) ?? null;
  }

  async insertSiteVersion(input: NewSiteVersionInput) {
    const id = `00000000-0000-4000-8000-${String(this.versionCounter).padStart(12, "0")}`;
    this.versionCounter += 1;

    const version: SiteVersionRow = {
      id,
      created_at: "2026-04-22T00:00:00.000Z",
      ...input
    };

    this.versions.push(version);
    return version;
  }

  async insertVersionChanges(changes: NewVersionChangeInput[]) {
    changes.forEach((change) => {
      const id = `00000000-0000-4000-8001-${String(this.changeCounter).padStart(12, "0")}`;
      this.changeCounter += 1;
      this.savedVersionChanges.push({
        ...change,
        id
      });
    });
  }

  async updateSiteCurrentVersion(siteId: string, versionId: string) {
    if (siteId !== this.siteId) {
      throw new Error("Unexpected site id");
    }

    this.currentVersionId.value = versionId;
  }
}

function createBaseStore() {
  const siteId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const clientId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const version1Id = "11111111-1111-4111-8111-111111111111";
  const currentVersionId = { value: version1Id };

  const versions: SiteVersionRow[] = [
    {
      id: version1Id,
      client_id: clientId,
      site_id: siteId,
      version_number: 1,
      parent_version_id: null,
      rollback_from_version_id: null,
      snapshot_json: {
        hero: {
          title: "旧タイトル"
        },
        contact: {
          phone: "03-0000-0000"
        }
      },
      summary: "初回公開",
      created_by_user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      source_change_set_id: null,
      created_at: "2026-04-22T00:00:00.000Z"
    }
  ];

  const changeSets: ChangeSetRow[] = [
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      client_id: clientId,
      site_id: siteId,
      chat_session_id: null,
      status: "approved",
      requested_by_user_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      approved_by_user_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      intent_category: "expression_update",
      summary: "トップ見出しの更新",
      payload_json: {
        basedOnVersionId: version1Id,
        proposedSnapshotJson: {
          hero: {
            title: "新タイトル"
          },
          contact: {
            phone: "03-0000-0000"
          }
        }
      },
      created_at: "2026-04-22T00:00:00.000Z",
      updated_at: "2026-04-22T00:00:00.000Z",
      approved_at: "2026-04-22T00:00:00.000Z",
      applied_at: null,
      rejected_at: null
    }
  ];

  return new InMemoryVersioningStore(siteId, currentVersionId, versions, changeSets);
}

describe("createNextVersionNumber", () => {
  it("returns 1 when there is no current version", () => {
    expect(createNextVersionNumber(null)).toBe(1);
  });

  it("increments the current version number", () => {
    expect(createNextVersionNumber(4)).toBe(5);
  });
});

describe("createVersionDiff", () => {
  it("detects changed, added, and removed values", () => {
    const diff = createVersionDiff(
      {
        hero: {
          title: "旧タイトル",
          subtitle: "旧サブタイトル"
        },
        contact: {
          phone: "03-0000-0000"
        }
      },
      {
        hero: {
          title: "新タイトル"
        },
        contact: {
          phone: "03-0000-0000",
          email: "hello@example.com"
        }
      }
    );

    expect(diff).toHaveLength(3);
    expect(diff.map((entry) => entry.pathLabel)).toEqual([
      "contact.email",
      "hero.subtitle",
      "hero.title"
    ]);
    expect(diff.map((entry) => entry.changeType)).toEqual([
      "added",
      "removed",
      "changed"
    ]);
  });
});

describe("publishChangeSet", () => {
  it("creates a new site version, saves diffs, and updates current_version_id", async () => {
    const store = createBaseStore();

    const result = await publishChangeSet(store, {
      changeSetId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorUserId: "99999999-9999-4999-8999-999999999999",
      now: () => "2026-04-22T10:00:00.000Z"
    });

    expect(result.version.version_number).toBe(2);
    expect(result.version.parent_version_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(result.version.source_change_set_id).toBe("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(store.versions).toHaveLength(2);
    expect(store.savedVersionChanges).toHaveLength(1);
    expect(store.savedVersionChanges[0]?.field_key).toBe("title");
    expect(store.changeSets[0]?.status).toBe("applied");
    expect(store.changeSets[0]?.applied_at).toBe("2026-04-22T10:00:00.000Z");
    expect(store.currentVersionId.value).toBe(result.version.id);
  });

  it("rejects already applied change sets", async () => {
    const store = createBaseStore();
    store.changeSets[0]!.status = "applied";

    await expect(
      publishChangeSet(store, {
        changeSetId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
      })
    ).rejects.toBeInstanceOf(ChangeSetAlreadyAppliedError);
  });

  it("rejects stale change sets based on an older version", async () => {
    const store = createBaseStore();

    store.versions.push({
      id: "22222222-2222-4222-8222-222222222222",
      client_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      site_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      version_number: 2,
      parent_version_id: "11111111-1111-4111-8111-111111111111",
      rollback_from_version_id: null,
      snapshot_json: {
        hero: {
          title: "別の更新"
        }
      },
      summary: "別変更",
      created_by_user_id: "33333333-3333-4333-8333-333333333333",
      source_change_set_id: null,
      created_at: "2026-04-22T01:00:00.000Z"
    });
    store.currentVersionId.value = "22222222-2222-4222-8222-222222222222";

    await expect(
      publishChangeSet(store, {
        changeSetId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
      })
    ).rejects.toBeInstanceOf(VersionConflictError);
  });
});

describe("rollbackToVersion", () => {
  it("creates a new version from a historical snapshot without overwriting the old one", async () => {
    const store = createBaseStore();

    const publishResult = await publishChangeSet(store, {
      changeSetId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorUserId: "99999999-9999-4999-8999-999999999999"
    });

    const result = await rollbackToVersion(store, {
      siteId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      targetVersionId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "12121212-1212-4121-8121-121212121212"
    });

    expect(result.version.version_number).toBe(3);
    expect(result.version.parent_version_id).toBe(publishResult.version.id);
    expect(result.version.rollback_from_version_id).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
    expect(result.version.snapshot_json).toEqual(store.versions[0]?.snapshot_json);
    expect(store.versions.find((version) => version.id === "11111111-1111-4111-8111-111111111111")?.version_number).toBe(1);
    expect(store.currentVersionId.value).toBe(result.version.id);
    expect(store.savedVersionChanges.at(-1)?.summary).toContain("hero.title");
  });
});
