import type {
  ChangeSetRow,
  NewSiteVersionInput,
  NewVersionChangeInput,
  SiteVersionRow
} from "@/lib/versioning/types";

export interface VersioningStore {
  getChangeSetById(changeSetId: string): Promise<ChangeSetRow | null>;
  updateChangeSet(
    changeSetId: string,
    patch: Partial<ChangeSetRow>
  ): Promise<ChangeSetRow>;
  getCurrentSiteVersion(siteId: string): Promise<SiteVersionRow | null>;
  getSiteVersionById(versionId: string): Promise<SiteVersionRow | null>;
  insertSiteVersion(input: NewSiteVersionInput): Promise<SiteVersionRow>;
  insertVersionChanges(changes: NewVersionChangeInput[]): Promise<void>;
  updateSiteCurrentVersion(siteId: string, versionId: string): Promise<void>;
}
