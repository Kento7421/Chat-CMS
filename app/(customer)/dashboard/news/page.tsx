import { NewsComposer } from "@/components/forms/news-composer";
import { SectionCard } from "@/components/layout/section-card";
import { listAccessibleSitesForAppUser, requireCustomerUser } from "@/lib/auth/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DashboardNewsPageProps = {
  searchParams?: Promise<{
    siteId?: string;
  }>;
};

export default async function DashboardNewsPage({
  searchParams
}: DashboardNewsPageProps) {
  const appUser = await requireCustomerUser();
  const sites = await listAccessibleSitesForAppUser(appUser);
  const params = (await searchParams) ?? {};
  const selectedSiteId = params.siteId ?? sites[0]?.id;
  const recentNews = selectedSiteId ? await getRecentNews(selectedSiteId) : [];

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">お知らせ投稿</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
          ログイン中の顧客に紐づく site を選んでお知らせを公開できます。公開時は
          `news_posts` を保存した上で、新しい `site_version` も作成されます。
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="新規投稿"
          description="対象サイトはログイン中ユーザーが操作できる site だけに限定しています。"
        >
          <NewsComposer sites={sites} defaultSiteId={selectedSiteId} />
        </SectionCard>

        <SectionCard
          title="最近のお知らせ"
          description="選択中の site に紐づく最近のお知らせを確認できます。"
        >
          <div className="space-y-3">
            {recentNews.length > 0 ? (
              recentNews.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4"
                >
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-sea">
                    {item.published_at ?? "draft"}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                まだお知らせがありません。
              </p>
            )}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

async function getRecentNews(siteId: string) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("news_posts")
      .select("id,title,body,published_at")
      .eq("site_id", siteId)
      .order("published_at", { ascending: false })
      .limit(5);

    if (error) {
      return [];
    }

    return data;
  } catch {
    return [];
  }
}
