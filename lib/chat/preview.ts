import type {
  PendingChangePreview,
  PendingPagePreview,
  PendingSectionPreview,
  SectionPreviewState
} from "@/lib/chat/types";
import { createSectionPreviewState } from "@/lib/site-section-state";
import type { SitePageKey, SiteSnapshot } from "@/types/domain";

function isEqualArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isEqualImage(before: SectionPreviewState["image"], after: SectionPreviewState["image"]) {
  return (
    before?.assetId === after?.assetId &&
    before?.src === after?.src &&
    before?.alt === after?.alt
  );
}

function isEqualNewsItems(before: SectionPreviewState["newsItems"], after: SectionPreviewState["newsItems"]) {
  return JSON.stringify(before) === JSON.stringify(after);
}

function getPage(snapshot: SiteSnapshot, pageKey: SitePageKey) {
  return snapshot.pages.find((page) => page.key === pageKey) ?? null;
}

function inferChangedFields(before: SectionPreviewState, after: SectionPreviewState) {
  const changedFields: string[] = [];

  if (before.heading !== after.heading) {
    changedFields.push("heading");
  }

  if (before.body !== after.body) {
    changedFields.push("body");
  }

  if (!isEqualArray(before.contactLines, after.contactLines)) {
    changedFields.push("contact");
  }

  if (!isEqualImage(before.image, after.image)) {
    changedFields.push("image");
  }

  if (!isEqualNewsItems(before.newsItems, after.newsItems)) {
    changedFields.push("news");
  }

  return changedFields;
}

function collectChangedPageKeys(currentSnapshot: SiteSnapshot, proposedSnapshot: SiteSnapshot) {
  return Array.from(
    new Set([
      ...currentSnapshot.pages.map((page) => page.key),
      ...proposedSnapshot.pages.map((page) => page.key)
    ])
  );
}

function buildPagePreview(
  currentSnapshot: SiteSnapshot,
  proposedSnapshot: SiteSnapshot,
  pageKey: SitePageKey
): PendingPagePreview | null {
  const currentPage = getPage(currentSnapshot, pageKey);
  const proposedPage = getPage(proposedSnapshot, pageKey);
  const pageTitle = proposedPage?.title ?? currentPage?.title ?? pageKey;
  const sectionIds = Array.from(
    new Set([
      ...(currentPage?.sections.map((section) => section.id) ?? []),
      ...(proposedPage?.sections.map((section) => section.id) ?? []),
      ...(pageKey === "contact" ? ["contact-info"] : [])
    ])
  );

  const sectionPreviews = sectionIds
    .map((sectionId) => {
      const before = createSectionPreviewState(currentSnapshot, pageKey, sectionId);
      const after = createSectionPreviewState(proposedSnapshot, pageKey, sectionId);
      const changedFields = inferChangedFields(before, after);

      if (changedFields.length === 0) {
        return null;
      }

      const sectionLabel =
        proposedPage?.sections.find((section) => section.id === sectionId)?.heading ??
        currentPage?.sections.find((section) => section.id === sectionId)?.heading ??
        sectionId;

      return {
        sectionId,
        sectionLabel,
        changedFields,
        before,
        after
      } satisfies PendingSectionPreview;
    })
    .filter((section): section is PendingSectionPreview => section !== null);

  if (sectionPreviews.length === 0) {
    return null;
  }

  return {
    pageKey,
    pageTitle,
    sections: sectionPreviews
  };
}

export function buildPendingChangePreview(
  currentSnapshot: SiteSnapshot,
  proposedSnapshot: SiteSnapshot
): PendingChangePreview {
  const pages = collectChangedPageKeys(currentSnapshot, proposedSnapshot)
    .map((pageKey) => buildPagePreview(currentSnapshot, proposedSnapshot, pageKey))
    .filter((page): page is PendingPagePreview => page !== null);

  return {
    pages
  };
}
