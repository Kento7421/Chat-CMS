import type { Database, Json } from "@/types/database";
import type { AssetReference, NewsSnapshotItem, SiteSnapshot } from "@/types/domain";

type SiteRow = Database["public"]["Tables"]["sites"]["Row"];
type AssetRow = Database["public"]["Tables"]["assets"]["Row"];

const DEFAULT_SCHEMA_VERSION = "2026-04-22";
const DEFAULT_TEMPLATE_VERSION = "simple-corporate-v1";

function isPlainObject(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    pages: [
      {
        key: "home",
        title: "トップページ",
        sections: [
          {
            id: "hero",
            heading: site.name,
            body: "このサイトは Chat CMS から更新できます。"
          }
        ]
      },
      {
        key: "about",
        title: "会社概要",
        sections: [
          {
            id: "company-overview",
            heading: "会社概要",
            body: "会社情報は後から更新できます。"
          }
        ]
      },
      {
        key: "contact",
        title: "お問い合わせ",
        sections: [
          {
            id: "contact-info",
            heading: "お問い合わせ",
            body: "電話番号やメールアドレスを登録すると、ここに反映されます。"
          }
        ]
      },
      {
        key: "news",
        title: "お知らせ",
        sections: [
          {
            id: "news-intro",
            heading: "お知らせ",
            body: "最新のお知らせを掲載します。"
          }
        ]
      }
    ],
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
      ? (snapshotJson.pages as SiteSnapshot["pages"])
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

export function upsertSnapshotAsset(snapshot: SiteSnapshot, asset: AssetRow): SiteSnapshot {
  const assetReference = assetRowToSnapshotReference(asset);
  const assets = snapshot.assets.filter((item) => item.id !== asset.id);
  const assetIds = snapshot.assetIds.includes(asset.id)
    ? snapshot.assetIds
    : [...snapshot.assetIds, asset.id];

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
