import Link from "next/link";
import { Ga4ConnectionCheck } from "@/components/analytics/ga4-connection-check";
import { SectionCard } from "@/components/layout/section-card";
import { listAccessibleSitesForAppUser, requireCustomerUser } from "@/lib/auth/server";
import { getAnalyticsOverviewForAppUser } from "@/lib/analytics/service";

type DashboardAnalyticsPageProps = {
  searchParams?: Promise<{
    siteId?: string;
  }>;
};

export default async function DashboardAnalyticsPage({
  searchParams
}: DashboardAnalyticsPageProps) {
  const appUser = await requireCustomerUser();
  const accessibleSites = await listAccessibleSitesForAppUser(appUser);
  const params = (await searchParams) ?? {};
  const selectedSiteId = params.siteId ?? accessibleSites[0]?.id ?? null;
  const analytics = selectedSiteId
    ? await safeGetAnalyticsOverview(appUser, selectedSiteId)
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">アクセス状況</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
          今月の訪問数、先月との比較、よく見られているページをシンプルに確認できます。GA4 を使う設定になっている場合は、接続状態もここで確認できます。
        </p>
      </section>

      <SectionCard
        title="表示するサイト"
        description="複数のサイトがある場合は、ここでアクセス状況を見たいサイトを選びます。"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {accessibleSites.length > 0 ? (
              accessibleSites.map((site) => (
                <Link
                  key={site.id}
                  href={`/dashboard/analytics?siteId=${site.id}`}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    site.id === selectedSiteId
                      ? "bg-sea text-white"
                      : "border border-slate-300 bg-white text-slate-900 hover:border-slate-400"
                  }`}
                >
                  {site.name}
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-600">表示できるサイトがまだありません。</p>
            )}
          </div>

          {selectedSiteId ? (
            <Link
              href={`/dashboard/settings?siteId=${selectedSiteId}`}
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900"
            >
              このサイトの設定を開く
            </Link>
          ) : null}
        </div>
      </SectionCard>

      {selectedSiteId ? <Ga4ConnectionCheck siteId={selectedSiteId} /> : null}

      {analytics ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <SectionCard
              title="今月の訪問数"
              description={`${analytics.overview.currentMonthLabel} の合計です。`}
            >
              <p className="text-4xl font-semibold tracking-tight text-ink">
                {analytics.overview.currentMonthVisits.toLocaleString("ja-JP")}
              </p>
            </SectionCard>

            <SectionCard
              title="先月比"
              description={`${analytics.overview.previousMonthLabel} と比べた変化です。`}
            >
              <p
                className={`text-4xl font-semibold tracking-tight ${
                  (analytics.overview.percentChangeFromPreviousMonth ?? 0) >= 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {formatPercentChange(analytics.overview.percentChangeFromPreviousMonth)}
              </p>
            </SectionCard>

            <SectionCard
              title="データの状態"
              description="現在どのデータで表示しているかを確認できます。"
            >
              <p className="text-lg font-semibold text-ink">
                {analytics.overview.source === "ga4" ? "GA4 の実データを表示中" : "簡易データを表示中"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                更新時刻: {formatDateTime(analytics.overview.generatedAt)}
              </p>
            </SectionCard>
          </section>

          <SectionCard
            title="人気ページ"
            description={`${analytics.site.name} でよく見られているページです。`}
          >
            <div className="space-y-3">
              {analytics.overview.popularPages.map((page, index) => (
                <article
                  key={`${page.pageKey}-${page.title}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-4 py-4"
                >
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-sea">
                      Top {index + 1}
                    </p>
                    <p className="text-sm font-semibold text-ink">{page.title}</p>
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {page.visits.toLocaleString("ja-JP")} 訪問
                  </p>
                </article>
              ))}
            </div>
          </SectionCard>
        </>
      ) : (
        <SectionCard
          title="アクセス状況を表示できません"
          description="サイトを選ぶと、今月の訪問数や人気ページをここに表示します。"
        />
      )}
    </div>
  );
}

async function safeGetAnalyticsOverview(
  appUser: Awaited<ReturnType<typeof requireCustomerUser>>,
  siteId: string
) {
  try {
    return await getAnalyticsOverviewForAppUser(appUser, siteId);
  } catch {
    return null;
  }
}

function formatPercentChange(value: number | null) {
  if (value === null) {
    return "比較なし";
  }

  if (value === 0) {
    return "0%";
  }

  return `${value > 0 ? "+" : ""}${value.toLocaleString("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  })}%`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
