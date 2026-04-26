function encodeStoragePath(storagePath: string) {
  return storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildPublicAssetUrl(storagePath: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bucket =
    process.env.NEXT_PUBLIC_SUPABASE_ASSETS_BUCKET ??
    process.env.SUPABASE_ASSETS_BUCKET ??
    "site-assets";

  if (!supabaseUrl) {
    return null;
  }

  const encodedPath = encodeStoragePath(storagePath);

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}
