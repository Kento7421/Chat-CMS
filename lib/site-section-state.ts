import { buildPublicAssetUrl } from "@/lib/assets/public-url";
import type { SectionPreviewState } from "@/lib/chat/types";
import type { SitePageKey, SiteSnapshot } from "@/types/domain";

function getPage(snapshot: SiteSnapshot, pageKey: SitePageKey) {
  return snapshot.pages.find((page) => page.key === pageKey) ?? null;
}

function getSection(snapshot: SiteSnapshot, pageKey: SitePageKey, sectionId: string) {
  const page = getPage(snapshot, pageKey);
  return page?.sections.find((section) => section.id === sectionId) ?? null;
}

function buildContactLines(snapshot: SiteSnapshot) {
  return [
    snapshot.contact.phone ? `TEL ${snapshot.contact.phone}` : "",
    snapshot.contact.email ? `MAIL ${snapshot.contact.email}` : "",
    snapshot.contact.businessHours ? `Hours ${snapshot.contact.businessHours}` : ""
  ].filter(Boolean);
}

function buildImageState(snapshot: SiteSnapshot, pageKey: SitePageKey, sectionId: string) {
  const section = getSection(snapshot, pageKey, sectionId);
  const assetId = section?.imageAssetId ?? null;

  if (!assetId) {
    return null;
  }

  const asset = snapshot.assets.find((item) => item.id === assetId);

  return {
    assetId,
    src: asset ? buildPublicAssetUrl(asset.storagePath) : null,
    alt: section?.imageAlt ?? asset?.altText ?? section?.heading ?? "Section image"
  };
}

function buildNewsItems(snapshot: SiteSnapshot, pageKey: SitePageKey, sectionId: string) {
  if (pageKey !== "news" || sectionId !== "news-intro") {
    return [];
  }

  return snapshot.news.slice(0, 3);
}

export function createSectionPreviewState(
  snapshot: SiteSnapshot,
  pageKey: SitePageKey,
  sectionId: string
): SectionPreviewState {
  const section = getSection(snapshot, pageKey, sectionId);

  if (!section) {
    return {
      heading: "",
      body: "",
      contactLines: pageKey === "contact" && sectionId === "contact-info" ? buildContactLines(snapshot) : [],
      image: buildImageState(snapshot, pageKey, sectionId),
      newsItems: buildNewsItems(snapshot, pageKey, sectionId)
    };
  }

  return {
    heading: section.heading,
    body: section.body,
    contactLines: pageKey === "contact" && sectionId === "contact-info" ? buildContactLines(snapshot) : [],
    image: buildImageState(snapshot, pageKey, sectionId),
    newsItems: buildNewsItems(snapshot, pageKey, sectionId)
  };
}
