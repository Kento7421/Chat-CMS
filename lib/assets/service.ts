import path from "node:path";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type UploadAssetInput = {
  clientId: string;
  siteId: string;
  userId: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  file: File;
};

function sanitizeFilename(filename: string) {
  const extension = path.extname(filename);
  const baseName = path.basename(filename, extension);
  const safeBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-");
  const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, "");

  return `${safeBaseName || "image"}${safeExtension}`;
}

export async function uploadAsset(input: UploadAssetInput) {
  const supabase = createSupabaseAdminClient();
  const { SUPABASE_ASSETS_BUCKET } = getServerEnv();
  const assetId = crypto.randomUUID();
  const storagePath = `${input.siteId}/${assetId}/${sanitizeFilename(input.file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_ASSETS_BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.file.type,
      upsert: false
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from("assets")
    .insert({
      id: assetId,
      client_id: input.clientId,
      site_id: input.siteId,
      kind: "image",
      storage_path: storagePath,
      original_filename: input.file.name,
      mime_type: input.file.type,
      byte_size: input.file.size,
      width: input.width ?? null,
      height: input.height ?? null,
      alt_text: input.altText ?? null,
      created_by_user_id: input.userId
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const publicUrl = supabase.storage.from(SUPABASE_ASSETS_BUCKET).getPublicUrl(storagePath).data
    .publicUrl;

  return {
    asset: data,
    publicUrl
  };
}
