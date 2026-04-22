type CreateNewsPostInput = {
  clientId: string;
  siteId: string;
  userId: string;
  title: string;
  body: string;
  imageAssetId?: string | null;
  publish: boolean;
};
import {
  normalizeSiteSnapshot,
  upsertNewsPostInSnapshot,
  upsertSnapshotAsset
} from "@/lib/site-snapshot";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { publishSnapshotVersion, SupabaseVersioningStore } from "@/lib/versioning";
import type { Json } from "@/types/database";

export async function createNewsPost(input: CreateNewsPostInput) {
  const supabase = createSupabaseAdminClient();
  const publishedAt = input.publish ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from("news_posts")
    .insert({
      client_id: input.clientId,
      site_id: input.siteId,
      title: input.title,
      body: input.body,
      image_asset_id: input.imageAssetId ?? null,
      status: input.publish ? "published" : "draft",
      published_at: publishedAt,
      created_by_user_id: input.userId
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!input.publish || !publishedAt) {
    return {
      newsPost: data,
      publishedVersion: null
    };
  }

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id,name,template_id")
    .eq("id", input.siteId)
    .single();

  if (siteError) {
    throw new Error(siteError.message);
  }

  const store = new SupabaseVersioningStore(supabase);
  const currentVersion = await store.getCurrentSiteVersion(input.siteId);
  const currentSnapshot = normalizeSiteSnapshot(currentVersion?.snapshot_json, site);

  let nextSnapshot = currentSnapshot;

  if (data.image_asset_id) {
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("*")
      .eq("id", data.image_asset_id)
      .maybeSingle();

    if (assetError) {
      throw new Error(assetError.message);
    }

    if (asset) {
      nextSnapshot = upsertSnapshotAsset(nextSnapshot, asset);
    }
  }

  nextSnapshot = upsertNewsPostInSnapshot(nextSnapshot, {
    id: data.id,
    title: data.title,
    body: data.body,
    publishedAt,
    imageAssetId: data.image_asset_id
  });

  const publishedVersion = await publishSnapshotVersion(store, {
    clientId: input.clientId,
    siteId: input.siteId,
    actorUserId: input.userId,
    summary: `お知らせ「${data.title}」を公開`,
    snapshot: nextSnapshot as unknown as Json
  });

  return {
    newsPost: data,
    publishedVersion
  };
}
