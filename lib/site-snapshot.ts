import type { Database, Json } from "@/types/database";
import type {
  AssetReference,
  NewsSnapshotItem,
  SitePageSnapshot,
  SiteSnapshot
} from "@/types/domain";

type SiteRow = Database["public"]["Tables"]["sites"]["Row"];
type AssetRow = Database["public"]["Tables"]["assets"]["Row"];

const DEFAULT_SCHEMA_VERSION = "2026-04-22";
const DEFAULT_TEMPLATE_VERSION = "simple-corporate-v1";

function isPlainObject(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createDefaultPages(siteName: string): SitePageSnapshot[] {
  return [
    {
      key: "home",
      title: "Home",
      sections: [
        {
          id: "hero",
          heading: siteName,
          body: "Welcome to your public site.",
          imageAssetId: null,
          imageAlt: null
        }
      ]
    },
    {
      key: "about",
      title: "About",
      sections: [
        {
          id: "company-overview",
          heading: "About Us",
          body: "Add your company profile here.",
          imageAssetId: null,
          imageAlt: null
        }
      ]
    },
    {
      key: "contact",
      title: "Contact",
      sections: [
        {
          id: "contact-info",
          heading: "Contact",
          body: "Add contact details so visitors can reach you.",
          imageAssetId: null,
          imageAlt: null
        }
      ]
    },
    {
      key: "news",
      title: "News",
      sections: [
        {
          id: "news-intro",
          heading: "News",
          body: "Share the latest updates from your company.",
          imageAssetId: null,
          imageAlt: null
        }
      ]
    }
  ];
}

export function createDefaultSiteSnapshot(site: Pick<SiteRow, "id" | "name" | "template_id">): SiteSnapshot {
  return {
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    templateVersion: DEFAULT_TEMPLATE_VERSION,
    siteId: site.id,
    templateId: site.template_id,
    siteName: site.name,
    navigation: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
      { label: "News", href: "/news" },
      { label: "Contact", href: "/contact" }
    ],
    theme: {
      accentColor: "#0f766e",
      backgroundColor: "#f8f5ef",
      textColor: "#101828"
    },
    contact: {
      phone: "",
      email: "",
      businessHours: ""
    },
    pages: createDefaultPages(site.name),
    news: [],
    assets: [],
    assetIds: []
  };
}

export function normalizeSiteSnapshot(
  snapshotJson: Json | null | undefined,
  site: Pick<SiteRow, "id" | "name" | "template_id">
): SiteSnapshot {
  const fallback = createDefaultSiteSnapshot(site);

  if (!isPlainObject(snapshotJson)) {
    return fallback;
  }

  return {
    ...fallback,
    ...snapshotJson,
    theme: {
      ...fallback.theme,
      ...(isPlainObject(snapshotJson.theme) ? snapshotJson.theme : {})
    },
    contact: {
      ...fallback.contact,
      ...(isPlainObject(snapshotJson.contact) ? snapshotJson.contact : {})
    },
    navigation: Array.isArray(snapshotJson.navigation)
      ? (snapshotJson.navigation as SiteSnapshot["navigation"])
      : fallback.navigation,
    pages: Array.isArray(snapshotJson.pages)
      ? (snapshotJson.pages as unknown as SiteSnapshot["pages"])
      : fallback.pages,
    news: Array.isArray(snapshotJson.news)
      ? (snapshotJson.news as unknown as SiteSnapshot["news"])
      : fallback.news,
    assets: Array.isArray(snapshotJson.assets)
      ? (snapshotJson.assets as unknown as SiteSnapshot["assets"])
      : fallback.assets,
    assetIds: Array.isArray(snapshotJson.assetIds)
      ? (snapshotJson.assetIds as string[])
      : fallback.assetIds
  };
}

export function assetRowToSnapshotReference(asset: AssetRow): AssetReference {
  return {
    id: asset.id,
    kind: asset.kind,
    storagePath: asset.storage_path,
    altText: asset.alt_text,
    mimeType: asset.mime_type,
    width: asset.width,
    height: asset.height
  };
}

export function upsertSnapshotAsset(snapshot: SiteSnapshot, asset: AssetRow | AssetReference): SiteSnapshot {
  const assetReference =
    "storage_path" in asset ? assetRowToSnapshotReference(asset as AssetRow) : (asset as AssetReference);
  const assets = snapshot.assets.filter((item) => item.id !== assetReference.id);
  const assetIds = snapshot.assetIds.includes(assetReference.id)
    ? snapshot.assetIds
    : [...snapshot.assetIds, assetReference.id];

  return {
    ...snapshot,
    assets: [...assets, assetReference],
    assetIds
  };
}

export function upsertNewsPostInSnapshot(
  snapshot: SiteSnapshot,
  newsItem: NewsSnapshotItem
): SiteSnapshot {
  const nextNews = [newsItem, ...snapshot.news.filter((item) => item.id !== newsItem.id)].sort(
    (left, right) => right.publishedAt.localeCompare(left.publishedAt)
  );

  return {
    ...snapshot,
    news: nextNews
  };
}
