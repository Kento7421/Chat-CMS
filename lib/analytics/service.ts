import {
  type AnalyticsConnectionCheckResult,
  type AnalyticsSettingsUpdateInput,
  analyticsOverviewSchema,
  analyticsSiteConfigSchema,
  type AnalyticsOverview,
  type AnalyticsSiteConfig
} from "@/lib/analytics/schemas";
import { getServerEnv } from "@/lib/env";
import { normalizeSiteSnapshot } from "@/lib/site-snapshot";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/auth/types";
import type { Database } from "@/types/database";
import type { SitePageKey, SiteSnapshot } from "@/types/domain";

type AnalyticsSiteRecord = {
  id: string;
  name: string;
  slug: string;
  template_id: string;
  current_version_id: string | null;
  analytics_provider: "fallback" | "ga4";
  ga4_property_id: string | null;
};

type AnalyticsContext = {
  site: AnalyticsSiteRecord;
  siteConfig: AnalyticsSiteConfig;
  snapshot: SiteSnapshot;
  now: Date;
};

type SiteVersionSnapshotRow = Pick<
  Database["public"]["Tables"]["site_versions"]["Row"],
  "snapshot_json"
>;

export type AnalyticsOverviewProvider = {
  source: "fallback" | "ga4";
  isAvailable: (context: AnalyticsContext) => Promise<boolean>;
  loadOverview: (context: AnalyticsContext) => Promise<AnalyticsOverview | null>;
};

export async function getAnalyticsOverviewForAppUser(
  appUser: AppUser,
  siteId: string
): Promise<{
  site: Pick<AnalyticsSiteRecord, "id" | "name" | "slug">;
  overview: AnalyticsOverview;
}> {
  const { site, siteConfig, snapshot } = await loadAnalyticsSiteContextForAppUser(appUser, siteId);
  const overview = await loadAnalyticsOverview({
    site,
    siteConfig,
    snapshot,
    now: new Date()
  });

  return {
    site: {
      id: site.id,
      name: site.name,
      slug: site.slug
    },
    overview
  };
}

export async function getAnalyticsConnectionStatusForAppUser(
  appUser: AppUser,
  siteId: string
): Promise<{
  site: Pick<AnalyticsSiteRecord, "id" | "name" | "slug">;
  result: AnalyticsConnectionCheckResult;
}> {
  const { site, siteConfig } = await loadAnalyticsSiteContextForAppUser(appUser, siteId);
  const serverEnv = getServerEnv();
  const { checkGa4Connection } = await import("@/lib/analytics/ga4.server");
  const result = await checkGa4Connection({
    siteConfig,
    now: new Date(),
    env: serverEnv
  });

  return {
    site: {
      id: site.id,
      name: site.name,
      slug: site.slug
    },
    result
  };
}

export async function getAnalyticsSettingsForAppUser(
  appUser: AppUser,
  siteId: string
): Promise<{
  site: Pick<AnalyticsSiteRecord, "id" | "name" | "slug">;
  siteConfig: AnalyticsSiteConfig;
}> {
  const { site, siteConfig } = await loadAnalyticsSiteContextForAppUser(appUser, siteId);

  return {
    site: {
      id: site.id,
      name: site.name,
      slug: site.slug
    },
    siteConfig
  };
}

export async function updateAnalyticsSettingsForAppUser(
  appUser: AppUser,
  input: AnalyticsSettingsUpdateInput
): Promise<{
  site: Pick<AnalyticsSiteRecord, "id" | "name" | "slug">;
  siteConfig: AnalyticsSiteConfig;
}> {
  void appUser;
  const supabase = await createSupabaseServerClient();
  const rpc = supabase.rpc as unknown as (
    fn: "update_site_analytics_settings",
    args: {
      p_site_id: string;
      p_provider: "fallback" | "ga4";
      p_ga4_property_id: string | null;
    }
  ) => Promise<{
    data: Database["public"]["Tables"]["sites"]["Row"] | null;
    error: { message: string } | null;
  }>;

  const { data, error } = await rpc("update_site_analytics_settings", {
    p_site_id: input.siteId,
    p_provider: input.provider,
    p_ga4_property_id: input.provider === "ga4" ? input.ga4PropertyId : null
  });

  if (error) {
    throw new Error(error.message);
  }

  const site = data as Database["public"]["Tables"]["sites"]["Row"] | null;

  if (!site) {
    throw new Error("Updated site was not returned.");
  }

  return {
    site: {
      id: site.id,
      name: site.name,
      slug: site.slug
    },
    siteConfig: createAnalyticsSiteConfig(site)
  };
}

export function createAnalyticsSiteConfig(input: {
  analytics_provider?: "fallback" | "ga4" | null;
  ga4_property_id?: string | null;
}): AnalyticsSiteConfig {
  return analyticsSiteConfigSchema.parse({
    provider: input.analytics_provider ?? "fallback",
    ga4PropertyId: input.ga4_property_id?.trim() ? input.ga4_property_id.trim() : null
  });
}

export function shouldUseGa4Provider(input: {
  siteConfig: AnalyticsSiteConfig;
  hasGa4Credentials: boolean;
}) {
  return Boolean(
    input.siteConfig.provider === "ga4" &&
      input.siteConfig.ga4PropertyId &&
      input.hasGa4Credentials
  );
}

export async function loadAnalyticsOverview(context: AnalyticsContext) {
  const providers = await createAnalyticsOverviewProviders();

  for (const provider of providers) {
    if (!(await provider.isAvailable(context))) {
      continue;
    }

    try {
      const overview = await provider.loadOverview(context);

      if (overview) {
        return analyticsOverviewSchema.parse(overview);
      }
    } catch {
      continue;
    }
  }

  return buildFallbackAnalyticsOverview(context);
}

async function createAnalyticsOverviewProviders(): Promise<AnalyticsOverviewProvider[]> {
  const serverEnv = getServerEnv();
  const { hasGa4Credentials, loadGa4AnalyticsOverview } = await import("@/lib/analytics/ga4.server");

  return [
    {
      source: "ga4",
      async isAvailable(context) {
        return shouldUseGa4Provider({
          siteConfig: context.siteConfig,
          hasGa4Credentials: hasGa4Credentials(serverEnv)
        });
      },
      async loadOverview(context) {
        return loadGa4AnalyticsOverview({
          siteConfig: context.siteConfig,
          snapshot: context.snapshot,
          now: context.now,
          env: serverEnv
        });
      }
    },
    {
      source: "fallback",
      async isAvailable() {
        return true;
      },
      async loadOverview(context) {
        return buildFallbackAnalyticsOverview(context);
      }
    }
  ];
}

async function loadAnalyticsSiteContextForAppUser(appUser: AppUser, siteId: string) {
  void appUser;
  const supabase = await createSupabaseServerClient();
  const { data: siteData, error: siteError } = await supabase
    .from("sites")
    .select("id,name,slug,template_id,current_version_id,analytics_provider,ga4_property_id")
    .eq("id", siteId)
    .maybeSingle();

  if (siteError) {
    throw new Error(siteError.message);
  }

  const site = siteData as AnalyticsSiteRecord | null;

  if (!site) {
    throw new Error("Site was not found.");
  }

  let snapshotJson = null;

  if (site.current_version_id) {
    const { data: versionData, error: versionError } = await supabase
      .from("site_versions")
      .select("snapshot_json")
      .eq("id", site.current_version_id)
      .maybeSingle();

    if (versionError) {
      throw new Error(versionError.message);
    }

    const currentVersion = versionData as SiteVersionSnapshotRow | null;
    snapshotJson = currentVersion?.snapshot_json ?? null;
  }

  const snapshot = normalizeSiteSnapshot(snapshotJson, site);
  const siteConfig = createAnalyticsSiteConfig(site);

  return {
    site,
    siteConfig,
    snapshot
  };
}

export function calculatePercentChange(currentValue: number, previousValue: number) {
  if (previousValue <= 0) {
    return null;
  }

  return Math.round(((currentValue - previousValue) / previousValue) * 1000) / 10;
}

export function buildFallbackAnalyticsOverview(
  context: Pick<AnalyticsContext, "site" | "snapshot" | "now">
): AnalyticsOverview {
  const currentMonthLabel = formatMonthLabel(context.now);
  const previousMonth = new Date(context.now);
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  const previousMonthLabel = formatMonthLabel(previousMonth);
  const siteSeed = createDeterministicSeed(context.site.id);
  const pageSeed = Math.max(context.snapshot.pages.length, 1);
  const currentMonthVisits = 600 + (siteSeed % 1500) + pageSeed * 55;
  const previousMonthVisits = Math.max(120, currentMonthVisits - 110 + (siteSeed % 240));

  return {
    source: "fallback",
    generatedAt: context.now.toISOString(),
    currentMonthLabel,
    previousMonthLabel,
    currentMonthVisits,
    previousMonthVisits,
    percentChangeFromPreviousMonth: calculatePercentChange(currentMonthVisits, previousMonthVisits),
    popularPages: buildFallbackPopularPages(context.snapshot, currentMonthVisits)
  };
}

function buildFallbackPopularPages(snapshot: SiteSnapshot, currentMonthVisits: number) {
  const pages = snapshot.pages.length > 0 ? snapshot.pages : createDefaultPageSummaries(snapshot);

  return pages.slice(0, 5).map((page, index) => ({
    pageKey: page.key,
    title: page.title,
    visits: Math.max(40, currentMonthVisits - index * 180)
  }));
}

function createDefaultPageSummaries(snapshot: SiteSnapshot) {
  const pageKeys: SitePageKey[] = ["home", "about", "contact", "news"];

  return pageKeys.map((pageKey) => ({
    key: pageKey,
    title: findPageTitle(snapshot, pageKey)
  }));
}

function findPageTitle(snapshot: SiteSnapshot, pageKey: SitePageKey) {
  const page = snapshot.pages.find((item) => item.key === pageKey);

  if (page?.title) {
    return page.title;
  }

  switch (pageKey) {
    case "home":
      return "トップページ";
    case "about":
      return "会社概要";
    case "services":
      return "サービス";
    case "contact":
      return "問い合わせ";
    case "news":
      return "お知らせ";
    default:
      return pageKey;
  }
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long"
  }).format(date);
}

function createDeterministicSeed(value: string) {
  return Array.from(value).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
}
