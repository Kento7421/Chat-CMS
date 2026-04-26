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
  AuditLogRow,
  ChangeSetRow,
  CommitVersionPublicationInput,
  NewSiteVersionInput,
  NewVersionChangeInput,
  NewsPostRow,
  SiteVersionRow
} from "../../lib/versioning/types";

class InMemoryVersioningStore implements VersioningStore {
  private versionCounter = 100;
  private changeCounter = 100;
  private auditCounter = 100;

  constructor(
    readonly siteId: string,
    readonly currentVersionId: { value: string | null },
    readonly versions: SiteVersionRow[],
    readonly changeSets: ChangeSetRow[],
    readonly savedVersionChanges: Array<NewVersionChangeInput & { id: string }> = [],
    readonly auditLogs: AuditLogRow[] = [],
    readonly newsPosts: NewsPostRow[] = [],
    readonly failStage:
      | "news"
      | "version"
      | "changes"
      | "site"
      | "change_set"
      | "audit"
      | null = null
  ) {}

  async getChangeSetById(changeSetId: string) {
    return this.changeSets.find((changeSet) => changeSet.id === changeSetId) ?? null;
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

  async commitVersionPublication(input: CommitVersionPublicationInput) {
    if (input.siteId !== this.siteId) {
      throw new Error("Unexpected site id");
    }

    if (this.currentVersionId.value !== input.expectedCurrentVersionId) {
      throw new Error("Current site version changed during publication.");
    }

    const stagedVersions = [...this.versions];
    const stagedChanges = [...this.savedVersionChanges];
    const stagedChangeSets = this.changeSets.map((item) => ({ ...item }));
    const stagedNewsPosts = [...this.newsPosts];
    const stagedAuditLogs = [...this.auditLogs];

    if (input.newsPost) {
      if (this.failStage === "news") {
        throw new Error("Forced failure at news stage");
      }

      stagedNewsPosts.push({
        id: input.newsPost.id ?? crypto.randomUUID(),
        client_id: input.newsPost.client_id,
        site_id: input.newsPost.site_id,
        title: input.newsPost.title,
        body: input.newsPost.body,
        image_asset_id: input.newsPost.image_asset_id,
        status: input.newsPost.status,
        published_at: input.newsPost.published_at,
        created_by_user_id: input.newsPost.created_by_user_id,
        created_at: "2026-04-22T00:00:00.000Z",
        updated_at: "2026-04-22T00:00:00.000Z"
      });
    }

    if (this.failStage === "version") {
      throw new Error("Forced failure at version stage");
    }

    const id = `00000000-0000-4000-8000-${String(this.versionCounter).padStart(12, "0")}`;
    const version: SiteVersionRow = {
      id,
      created_at: "2026-04-22T00:00:00.000Z",
      ...input.version
    };
    stagedVersions.push(version);

    if (this.failStage === "changes") {
      throw new Error("Forced failure at changes stage");
    }

    input.versionChanges.forEach((change) => {
      const changeId = `00000000-0000-4000-8001-${String(this.changeCounter).padStart(12, "0")}`;
      this.changeCounter += 1;
      stagedChanges.push({
        ...change,
        site_version_id: id,
        id: changeId
      });
    });

    if (this.failStage === "site") {
      throw new Error("Forced failure at site stage");
    }

    if (input.changeSetTransition) {
      const changeSet = stagedChangeSets.find((item) => item.id === input.changeSetTransition?.id);

      if (!changeSet) {
        throw new Error("Change set not found");
      }

      if (changeSet.status !== input.changeSetTransition.expectedStatus) {
        throw new Error("Change set status changed during publication.");
      }

      if (this.failStage === "change_set") {
        throw new Error("Forced failure at change set stage");
      }

      Object.assign(changeSet, input.changeSetTransition.patch);
    }

    if (input.auditLog) {
      if (this.failStage === "audit") {
        throw new Error("Forced failure at audit stage");
      }

      const auditId = `00000000-0000-4000-8002-${String(this.auditCounter).padStart(12, "0")}`;
      this.auditCounter += 1;
      stagedAuditLogs.push({
        id: auditId,
        ...input.auditLog,
        target_id: input.auditLog.target_id ?? id,
        metadata: {
          ...((input.auditLog.metadata as Record<string, unknown>) ?? {}),
          publishedVersionId: id
        },
        created_at: "2026-04-22T00:00:00.000Z"
      });
    }

    this.versionCounter += 1;
    this.currentVersionId.value = id;
    this.versions.splice(0, this.versions.length, ...stagedVersions);
    this.savedVersionChanges.splice(0, this.savedVersionChanges.length, ...stagedChanges);
    this.changeSets.splice(0, this.changeSets.length, ...stagedChangeSets);
    this.newsPosts.splice(0, this.newsPosts.length, ...stagedNewsPosts);
    this.auditLogs.splice(0, this.auditLogs.length, ...stagedAuditLogs);

    return {
      version,
      newsPost: stagedNewsPosts.at(-1) ?? null,
      auditLog: stagedAuditLogs.at(-1) ?? null
    };
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

function createAtomicFailureStore(failStage: InMemoryVersioningStore["failStage"]) {
  const store = createBaseStore();
  return new InMemoryVersioningStore(
    store.siteId,
    store.currentVersionId,
    store.versions,
    store.changeSets,
    store.savedVersionChanges,
    store.auditLogs,
    store.newsPosts,
    failStage
  );
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

describe("atomic publication", () => {
  it("does not leave a partial site version behind when the commit fails mid-flight", async () => {
    const store = createAtomicFailureStore("changes");

    await expect(
      publishChangeSet(store, {
        changeSetId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
      })
    ).rejects.toThrow("Forced failure at changes stage");

    expect(store.versions).toHaveLength(1);
    expect(store.savedVersionChanges).toHaveLength(0);
    expect(store.currentVersionId.value).toBe("11111111-1111-4111-8111-111111111111");
    expect(store.changeSets[0]?.status).toBe("approved");
  });

  it("does not advance the change set when a later publish step fails", async () => {
    const store = createAtomicFailureStore("audit");
    if (store.changeSets[0]) {
      store.changeSets[0].status = "awaiting_confirmation";
      store.changeSets[0].approved_at = null;
      store.changeSets[0].approved_by_user_id = null;
    }

    await expect(
      publishChangeSet(store, {
        changeSetId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        expectedChangeSetStatus: "awaiting_confirmation",
        changeSetPatch: {
          approved_by_user_id: "99999999-9999-4999-8999-999999999999",
          approved_at: "2026-04-22T10:00:00.000Z"
        },
        auditLog: {
          client_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          site_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          actor_user_id: "99999999-9999-4999-8999-999999999999",
          action: "publish",
          target_type: "site_version",
          target_id: null,
          metadata: {}
        }
      })
    ).rejects.toThrow("Forced failure at audit stage");

    expect(store.versions).toHaveLength(1);
    expect(store.currentVersionId.value).toBe("11111111-1111-4111-8111-111111111111");
    expect(store.changeSets[0]?.status).toBe("awaiting_confirmation");
    expect(store.changeSets[0]?.approved_at).toBeNull();
  });
});
