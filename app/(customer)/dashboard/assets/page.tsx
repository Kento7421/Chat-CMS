import { AssetUploader } from "@/components/forms/asset-uploader";
import { SectionCard } from "@/components/layout/section-card";
import { listAccessibleSitesForAppUser, requireCustomerUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DashboardAssetsPageProps = {
  searchParams?: Promise<{
    siteId?: string;
  }>;
};

export default async function DashboardAssetsPage({
  searchParams
}: DashboardAssetsPageProps) {
  const appUser = await requireCustomerUser();
  const sites = await listAccessibleSitesForAppUser(appUser);
  const params = (await searchParams) ?? {};
  const selectedSiteId = params.siteId ?? sites[0]?.id;
  const recentAssets = selectedSiteId ? await getRecentAssets(selectedSiteId) : [];

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">画像アップロード</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
          ログイン中の顧客に紐づく site に対して画像を登録できます。画像本体は Storage に保存し、
          DB には参照パスと metadata だけを残します。
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="画像を登録"
          description="対象サイトはログイン中ユーザーが操作できる site だけに限定しています。"
        >
          <AssetUploader sites={sites} defaultSiteId={selectedSiteId} />
        </SectionCard>

        <SectionCard
          title="最近の画像"
          description="選択中の site に紐づく最近の画像を確認できます。"
        >
          <div className="space-y-3">
            {recentAssets.length > 0 ? (
              recentAssets.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4"
                >
                  <p className="text-sm font-semibold text-ink">{item.original_filename}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.mime_type}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.width ?? "-"} x {item.height ?? "-"} / {item.byte_size} bytes
                  </p>
                  <p className="mt-3 break-all text-xs uppercase tracking-[0.12em] text-sea">
                    {item.id}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                まだ画像がありません。
              </p>
            )}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

async function getRecentAssets(siteId: string) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("assets")
      .select("id,original_filename,mime_type,byte_size,width,height")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      return [];
    }

    return data;
  } catch {
    return [];
  }
}
