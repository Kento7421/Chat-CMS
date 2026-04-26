import path from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { buildPublicAssetUrl } from "@/lib/assets/public-url";
import type { Database } from "@/types/database";
import type { ChatAssetOption } from "@/lib/chat/types";

type UploadAssetInput = {
  siteId: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  file: File;
};

type AssetRow = Database["public"]["Tables"]["assets"]["Row"];

function sanitizeFilename(filename: string) {
  const extension = path.extname(filename);
  const baseName = path.basename(filename, extension);
  const safeBaseName = baseName
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, "");

  return `${safeBaseName || "image"}${safeExtension}`;
}

function buildAssetStoragePath(siteId: string, assetId: string, filename: string) {
  return `${siteId}/${assetId}/${sanitizeFilename(filename)}`;
}

function toChatAssetOption(asset: AssetRow): ChatAssetOption {
  return {
    id: asset.id,
    originalFilename: asset.original_filename,
    altText: asset.alt_text,
    mimeType: asset.mime_type,
    width: asset.width,
    height: asset.height,
    publicUrl: buildPublicAssetUrl(asset.storage_path)
  };
}

export async function uploadAsset(input: UploadAssetInput) {
  const admin = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();
  const { SUPABASE_ASSETS_BUCKET } = getServerEnv();
  const assetId = crypto.randomUUID();
  const storagePath = buildAssetStoragePath(input.siteId, assetId, input.file.name);

  const { error: uploadError } = await admin.storage
    .from(SUPABASE_ASSETS_BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.file.type,
      upsert: false
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const rpc = supabase.rpc as unknown as (
    fn: "create_asset_record",
    args: {
      p_site_id: string;
      p_storage_path: string;
      p_original_filename: string;
      p_mime_type: string;
      p_byte_size: number;
      p_width: number | null;
      p_height: number | null;
      p_alt_text: string | null;
      p_asset_id: string;
    }
  ) => Promise<{
    data: AssetRow | null;
    error: { message: string } | null;
  }>;

  const { data, error } = await rpc("create_asset_record", {
    p_site_id: input.siteId,
    p_storage_path: storagePath,
    p_original_filename: input.file.name,
    p_mime_type: input.file.type,
    p_byte_size: input.file.size,
    p_width: input.width ?? null,
    p_height: input.height ?? null,
    p_alt_text: input.altText ?? null,
    p_asset_id: assetId
  });

  if (error || !data) {
    await admin.storage.from(SUPABASE_ASSETS_BUCKET).remove([storagePath]);
    throw new Error(error?.message ?? "Asset record could not be created.");
  }

  return {
    asset: data,
    publicUrl: buildPublicAssetUrl(storagePath)
  };
}

export async function listSiteAssets(siteId: string, limit = 24) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AssetRow[]).map(toChatAssetOption);
}

export async function getSiteAssetById(siteId: string, assetId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("site_id", siteId)
    .eq("id", assetId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AssetRow | null;
}

export function toPublicAssetOption(asset: AssetRow) {
  return toChatAssetOption(asset);
}

export { buildAssetStoragePath, sanitizeFilename };
