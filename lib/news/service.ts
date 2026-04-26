import {
  normalizeSiteSnapshot,
  upsertNewsPostInSnapshot,
  upsertSnapshotAsset
} from "@/lib/site-snapshot";
import { getSiteAssetById } from "@/lib/assets/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publishSnapshotVersion, SupabaseVersioningStore } from "@/lib/versioning";
import type { Database, Json } from "@/types/database";
import type { NewsSnapshotItem, SiteSnapshot } from "@/types/domain";

type CreateNewsPostInput = {
  id?: string;
  clientId: string;
  siteId: string;
  userId: string;
  title: string;
  body: string;
  imageAssetId?: string | null;
  publish: boolean;
  publishedAt?: string;
};

type NewsPostRow = Database["public"]["Tables"]["news_posts"]["Row"];
type SiteLookupRow = {
  id: string;
  name: string;
  template_id: string;
  current_version_id: string | null;
};

export function buildNewsSnapshotItem(input: {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  imageAssetId?: string | null;
}): NewsSnapshotItem {
  return {
    id: input.id,
    title: input.title,
    body: input.body,
    publishedAt: input.publishedAt,
    imageAssetId: input.imageAssetId ?? null
  };
}

export async function insertNewsPostRecord(input: {
  id?: string;
  siteId: string;
  title: string;
  body: string;
  imageAssetId?: string | null;
  publish: boolean;
  publishedAt?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const rpc = supabase.rpc as unknown as (
    fn: "create_news_post_record",
    args: {
      p_site_id: string;
      p_title: string;
      p_body: string;
      p_image_asset_id: string | null;
      p_status: NewsPostRow["status"];
      p_published_at: string | null;
      p_news_post_id: string | null;
    }
  ) => Promise<{
    data: NewsPostRow | null;
    error: { message: string } | null;
  }>;

  const { data, error } = await rpc("create_news_post_record", {
    p_site_id: input.siteId,
    p_title: input.title,
    p_body: input.body,
    p_image_asset_id: input.imageAssetId ?? null,
    p_status: input.publish ? "published" : "draft",
    p_published_at: input.publish ? input.publishedAt ?? new Date().toISOString() : null,
    p_news_post_id: input.id ?? null
  });

  if (error || !data) {
    throw new Error(error?.message ?? "News post record could not be created.");
  }

  return data;
}

export async function deleteNewsPostRecord(newsPostId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("news_posts").delete().eq("id", newsPostId);

  if (error) {
    throw new Error(error.message);
  }
}

async function loadSiteSnapshotForPublish(siteId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: siteData, error: siteError } = await supabase
    .from("sites")
    .select("id,name,template_id,current_version_id")
    .eq("id", siteId)
    .single();

  if (siteError) {
    throw new Error(siteError.message);
  }

  const site = siteData as SiteLookupRow;
  let snapshotJson: Json | null = null;

  if (site.current_version_id) {
    const { data: currentVersionData, error: versionError } = await supabase
      .from("site_versions")
      .select("snapshot_json")
      .eq("id", site.current_version_id)
      .maybeSingle();

    if (versionError) {
      throw new Error(versionError.message);
    }

    const currentVersion = currentVersionData as { snapshot_json: Json } | null;
    snapshotJson = currentVersion?.snapshot_json ?? null;
  }

  const currentSnapshot = normalizeSiteSnapshot(snapshotJson, site);

  return {
    site,
    currentSnapshot
  };
}

export async function createPublishedNewsSnapshot(input: {
  siteId: string;
  newsItem: NewsSnapshotItem;
}) {
  const { currentSnapshot } = await loadSiteSnapshotForPublish(input.siteId);
  let nextSnapshot: SiteSnapshot = currentSnapshot;

  if (input.newsItem.imageAssetId) {
    const asset = await getSiteAssetById(input.siteId, input.newsItem.imageAssetId);

    if (asset) {
      nextSnapshot = upsertSnapshotAsset(nextSnapshot, asset);
    }
  }

  return upsertNewsPostInSnapshot(nextSnapshot, input.newsItem);
}

export async function createNewsPost(input: CreateNewsPostInput) {
  const publishedAt = input.publish ? input.publishedAt ?? new Date().toISOString() : null;

  if (!input.publish || !publishedAt) {
    const newsPost = await insertNewsPostRecord({
      id: input.id,
      siteId: input.siteId,
      title: input.title,
      body: input.body,
      imageAssetId: input.imageAssetId ?? null,
      publish: false
    });

    return {
      newsPost,
      publishedVersion: null
    };
  }

  const newsPostId = input.id ?? crypto.randomUUID();
  const nextSnapshot = await createPublishedNewsSnapshot({
    siteId: input.siteId,
    newsItem: buildNewsSnapshotItem({
      id: newsPostId,
      title: input.title,
      body: input.body,
      publishedAt,
      imageAssetId: input.imageAssetId ?? null
    })
  });

  const store = new SupabaseVersioningStore(createSupabaseAdminClient());
  const publishedVersion = await publishSnapshotVersion(store, {
    clientId: input.clientId,
    siteId: input.siteId,
    actorUserId: input.userId,
    summary: `「${input.title}」を公開`,
    snapshot: nextSnapshot as unknown as Json,
    newsPost: {
      id: newsPostId,
      client_id: input.clientId,
      site_id: input.siteId,
      title: input.title,
      body: input.body,
      image_asset_id: input.imageAssetId ?? null,
      status: "published",
      published_at: publishedAt,
      created_by_user_id: input.userId
    }
  });

  const supabase = await createSupabaseServerClient();
  const { data: newsPostData, error: newsPostError } = await supabase
    .from("news_posts")
    .select("*")
    .eq("id", newsPostId)
    .maybeSingle();

  if (newsPostError) {
    throw new Error(newsPostError.message);
  }

  const newsPost = newsPostData as NewsPostRow | null;

  return {
    newsPost:
      newsPost ??
      ({
        id: newsPostId,
        client_id: input.clientId,
        site_id: input.siteId,
        title: input.title,
        body: input.body,
        image_asset_id: input.imageAssetId ?? null,
        status: "published" as const,
        published_at: publishedAt,
        created_by_user_id: input.userId,
        created_at: publishedAt,
        updated_at: publishedAt
      } as const),
    publishedVersion
  };
}
