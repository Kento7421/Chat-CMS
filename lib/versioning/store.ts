import type {
  ChangeSetRow,
  CommitVersionPublicationInput,
  CommitVersionPublicationResult,
  NewSiteVersionInput,
  NewVersionChangeInput,
  SiteVersionRow
} from "@/lib/versioning/types";

export interface VersioningStore {
  getChangeSetById(changeSetId: string): Promise<ChangeSetRow | null>;
  getCurrentSiteVersion(siteId: string): Promise<SiteVersionRow | null>;
  getSiteVersionById(versionId: string): Promise<SiteVersionRow | null>;
  commitVersionPublication(
    input: CommitVersionPublicationInput
  ): Promise<CommitVersionPublicationResult>;
  insertSiteVersion(input: NewSiteVersionInput): Promise<SiteVersionRow>;
  insertVersionChanges(changes: NewVersionChangeInput[]): Promise<void>;
  updateSiteCurrentVersion(siteId: string, versionId: string): Promise<void>;
}
