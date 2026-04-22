import Link from "next/link";
import { SectionCard } from "@/components/layout/section-card";
import { listAccessibleSitesForAppUser, requireCustomerUser } from "@/lib/auth/server";
import { listSiteVersionsForAppUser } from "@/lib/versions/service";

type DashboardHistoryPageProps = {
  searchParams?: Promise<{
    siteId?: string;
  }>;
};

export default async function DashboardHistoryPage({
  searchParams
}: DashboardHistoryPageProps) {
  const appUser = await requireCustomerUser();
  const accessibleSites = await listAccessibleSitesForAppUser(appUser);
  const params = (await searchParams) ?? {};
  const selectedSiteId = params.siteId ?? accessibleSites[0]?.id;
  const result = selectedSiteId
    ? await safeListSiteVersions(appUser, selectedSiteId)
    : {
        accessibleSites,
        selectedSiteId: null,
        site: null,
        versions: []
      };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">履歴一覧</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
          自社に紐づく site の履歴だけを確認できます。各版には summary を表示し、
          詳細画面から差分確認とロールバックができます。
        </p>
      </section>

      <SectionCard
        title="対象サイト"
        description="複数 site を持つ場合は、ここから表示対象を切り替えられます。"
      >
        <div className="flex flex-wrap gap-3">
          {result.accessibleSites.length ? (
            result.accessibleSites.map((site) => (
              <Link
                key={site.id}
                href={`/dashboard/history?siteId=${site.id}`}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  site.id === result.selectedSiteId
                    ? "bg-sea text-white"
                    : "border border-slate-300 bg-white text-slate-900 hover:border-slate-400"
                }`}
              >
                {site.name}
              </Link>
            ))
          ) : (
            <p className="text-sm text-slate-600">利用可能な site がありません。</p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="バージョン履歴"
        description={
          result.site
            ? `${result.site.name} の公開履歴です。`
            : "対象サイトを選ぶと履歴を表示します。"
        }
      >
        <div className="space-y-3">
          {result.versions.length ? (
            result.versions.map((version) => (
              <Link
                key={version.id}
                href={`/dashboard/history/${version.id}`}
                className="block rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 transition hover:border-slate-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Version {version.version_number}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {version.summary ?? "summary 未設定"}
                    </p>
                  </div>
                  <div className="text-right">
                    {version.isCurrent ? (
                      <span className="inline-flex rounded-full bg-sea/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sea">
                        Current
                      </span>
                    ) : null}
                    <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">
                      {version.created_at}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
              表示できる履歴がありません。
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

async function safeListSiteVersions(appUser: Awaited<ReturnType<typeof requireCustomerUser>>, siteId: string) {
  try {
    return await listSiteVersionsForAppUser(appUser, siteId);
  } catch {
    return {
      accessibleSites: await listAccessibleSitesForAppUser(appUser),
      selectedSiteId: siteId,
      site: null,
      versions: []
    };
  }
}
