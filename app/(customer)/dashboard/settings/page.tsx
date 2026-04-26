import Link from "next/link";
import { SiteAnalyticsSettingsForm } from "@/components/analytics/site-analytics-settings-form";
import { SectionCard } from "@/components/layout/section-card";
import { listAccessibleSitesForAppUser, requireCustomerUser } from "@/lib/auth/server";
import { getAnalyticsSettingsForAppUser } from "@/lib/analytics/service";

type DashboardSettingsPageProps = {
  searchParams?: Promise<{
    siteId?: string;
  }>;
};

export default async function DashboardSettingsPage({
  searchParams
}: DashboardSettingsPageProps) {
  const appUser = await requireCustomerUser();
  const accessibleSites = await listAccessibleSitesForAppUser(appUser);
  const params = (await searchParams) ?? {};
  const selectedSiteId = params.siteId ?? accessibleSites[0]?.id ?? null;
  const settings = selectedSiteId
    ? await safeGetAnalyticsSettings(appUser, selectedSiteId)
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">サイト設定</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
          site ごとのアクセス状況設定をここで変更できます。GA4 を使う設定にした後は、アクセス状況画面から接続確認まで続けて行えます。
        </p>
      </section>

      <SectionCard
        title="設定するサイト"
        description="複数のサイトがある場合は、設定を変更したいサイトを選びます。"
      >
        <div className="flex flex-wrap gap-3">
          {accessibleSites.length > 0 ? (
            accessibleSites.map((site) => (
              <Link
                key={site.id}
                href={`/dashboard/settings?siteId=${site.id}`}
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
            <p className="text-sm text-slate-600">設定できるサイトがまだありません。</p>
          )}
        </div>
      </SectionCard>

      {settings ? (
        <SectionCard
          title="アクセス状況の設定"
          description="簡易データを使うか、GA4 を使うかを選べます。"
        >
          <SiteAnalyticsSettingsForm
            siteId={settings.site.id}
            siteName={settings.site.name}
            initialConfig={settings.siteConfig}
          />
        </SectionCard>
      ) : (
        <SectionCard
          title="設定を表示できません"
          description="サイトを選ぶと、アクセス状況の設定をここで編集できます。"
        />
      )}
    </div>
  );
}

async function safeGetAnalyticsSettings(
  appUser: Awaited<ReturnType<typeof requireCustomerUser>>,
  siteId: string
) {
  try {
    return await getAnalyticsSettingsForAppUser(appUser, siteId);
  } catch {
    return null;
  }
}
