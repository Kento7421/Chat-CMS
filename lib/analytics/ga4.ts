import { createSign } from "node:crypto";
import {
  analyticsConnectionCheckResultSchema,
  analyticsOverviewSchema,
  type AnalyticsConnectionCheckResult,
  type AnalyticsSiteConfig,
  type AnalyticsOverview
} from "@/lib/analytics/schemas";
import type { SitePageKey, SiteSnapshot } from "@/types/domain";

export type Ga4Environment = {
  GA4_CLIENT_EMAIL?: string;
  GA4_PRIVATE_KEY?: string;
  GA4_TOKEN_URI: string;
  GA4_API_BASE_URL: string;
};

type LoadGa4AnalyticsOverviewInput = {
  siteConfig: AnalyticsSiteConfig;
  snapshot: SiteSnapshot;
  now: Date;
  env: Ga4Environment;
  fetchImpl?: typeof fetch;
};

type CheckGa4ConnectionInput = {
  siteConfig: AnalyticsSiteConfig;
  now: Date;
  env: Ga4Environment;
  fetchImpl?: typeof fetch;
  accessTokenLoader?: typeof getGa4AccessToken;
  reportRunner?: typeof runConnectionCheckReport;
};

type Ga4AccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type Ga4RunReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

export function hasGa4Credentials(env: Pick<Ga4Environment, "GA4_CLIENT_EMAIL" | "GA4_PRIVATE_KEY">) {
  return Boolean(env.GA4_CLIENT_EMAIL && env.GA4_PRIVATE_KEY);
}

export async function checkGa4Connection(
  input: CheckGa4ConnectionInput
): Promise<AnalyticsConnectionCheckResult> {
  const baseResult = {
    checkedAt: input.now.toISOString(),
    propertyId: input.siteConfig.ga4PropertyId,
    provider: input.siteConfig.provider
  } as const;

  if (input.siteConfig.provider !== "ga4") {
    return analyticsConnectionCheckResultSchema.parse({
      ...baseResult,
      ok: false,
      code: "provider_not_ga4",
      message: "このサイトは GA4 接続に設定されていません。"
    });
  }

  if (!input.siteConfig.ga4PropertyId) {
    return analyticsConnectionCheckResultSchema.parse({
      ...baseResult,
      ok: false,
      code: "property_missing",
      message: "GA4 プロパティ ID が未設定です。"
    });
  }

  if (!hasGa4Credentials(input.env)) {
    return analyticsConnectionCheckResultSchema.parse({
      ...baseResult,
      ok: false,
      code: "env_missing",
      message: "GA4 接続に必要なサーバー設定が不足しています。"
    });
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const accessTokenLoader = input.accessTokenLoader ?? getGa4AccessToken;
  const reportRunner = input.reportRunner ?? runConnectionCheckReport;

  try {
    const accessToken = await accessTokenLoader(input.env, fetchImpl, input.now);

    try {
      await reportRunner({
        propertyId: input.siteConfig.ga4PropertyId,
        accessToken,
        env: input.env,
        fetchImpl,
        now: input.now
      });

      return analyticsConnectionCheckResultSchema.parse({
        ...baseResult,
        ok: true,
        code: "ok",
        message: "GA4 に接続できました。"
      });
    } catch {
      return analyticsConnectionCheckResultSchema.parse({
        ...baseResult,
        ok: false,
        code: "report_failed",
        message: "GA4 のレポート取得に失敗しました。"
      });
    }
  } catch {
    return analyticsConnectionCheckResultSchema.parse({
      ...baseResult,
      ok: false,
      code: "token_failed",
      message: "GA4 の認証に失敗しました。"
    });
  }
}

export async function loadGa4AnalyticsOverview(
  input: LoadGa4AnalyticsOverviewInput
): Promise<AnalyticsOverview | null> {
  if (input.siteConfig.provider !== "ga4" || !input.siteConfig.ga4PropertyId) {
    return null;
  }

  if (!hasGa4Credentials(input.env)) {
    return null;
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const accessToken = await getGa4AccessToken(input.env, fetchImpl, input.now);
  const { currentMonthRange, previousMonthRange, currentMonthLabel, previousMonthLabel } =
    buildMonthRanges(input.now);

  const [currentMonthVisits, previousMonthVisits, popularPages] = await Promise.all([
    runSessionsReport({
      propertyId: input.siteConfig.ga4PropertyId,
      accessToken,
      env: input.env,
      fetchImpl,
      startDate: currentMonthRange.startDate,
      endDate: currentMonthRange.endDate
    }),
    runSessionsReport({
      propertyId: input.siteConfig.ga4PropertyId,
      accessToken,
      env: input.env,
      fetchImpl,
      startDate: previousMonthRange.startDate,
      endDate: previousMonthRange.endDate
    }),
    runPopularPagesReport({
      propertyId: input.siteConfig.ga4PropertyId,
      accessToken,
      env: input.env,
      fetchImpl,
      snapshot: input.snapshot,
      startDate: currentMonthRange.startDate,
      endDate: currentMonthRange.endDate
    })
  ]);

  return analyticsOverviewSchema.parse({
    source: "ga4",
    generatedAt: input.now.toISOString(),
    currentMonthLabel,
    previousMonthLabel,
    currentMonthVisits,
    previousMonthVisits,
    percentChangeFromPreviousMonth:
      previousMonthVisits > 0
        ? Math.round(((currentMonthVisits - previousMonthVisits) / previousMonthVisits) * 1000) /
          10
        : null,
    popularPages
  });
}

async function getGa4AccessToken(
  env: Ga4Environment,
  fetchImpl: typeof fetch,
  now: Date
) {
  const clientEmail = env.GA4_CLIENT_EMAIL;
  const privateKey = env.GA4_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("GA4 credentials are not configured.");
  }

  const tokenResponse = await fetchImpl(env.GA4_TOKEN_URI, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createJwtAssertion({
        clientEmail,
        privateKey,
        tokenUri: env.GA4_TOKEN_URI,
        now
      })
    })
  });

  if (!tokenResponse.ok) {
    throw new Error(`GA4 token request failed with status ${tokenResponse.status}.`);
  }

  const payload = (await tokenResponse.json()) as Ga4AccessTokenResponse;

  if (!payload.access_token) {
    throw new Error("GA4 token response did not include an access token.");
  }

  return payload.access_token;
}

function createJwtAssertion(input: {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
  now: Date;
}) {
  const issuedAt = Math.floor(input.now.getTime() / 1000);
  const expiresAt = issuedAt + 3600;
  const header = toBase64Url(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT"
    })
  );
  const payload = toBase64Url(
    JSON.stringify({
      iss: input.clientEmail,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: input.tokenUri,
      iat: issuedAt,
      exp: expiresAt
    })
  );
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(normalizePrivateKey(input.privateKey));

  return `${unsignedToken}.${signature
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")}`;
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, "\n");
}

function toBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function runSessionsReport(input: {
  propertyId: string;
  accessToken: string;
  env: Ga4Environment;
  fetchImpl: typeof fetch;
  startDate: string;
  endDate: string;
}) {
  const data = await runGa4Report(
    {
      propertyId: input.propertyId,
      accessToken: input.accessToken,
      env: input.env,
      fetchImpl: input.fetchImpl
    },
    {
      dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
      metrics: [{ name: "sessions" }]
    }
  );

  return parseMetricValue(data.rows?.[0]?.metricValues?.[0]?.value);
}

async function runConnectionCheckReport(input: {
  propertyId: string;
  accessToken: string;
  env: Ga4Environment;
  fetchImpl: typeof fetch;
  now: Date;
}) {
  const today = toDateString(input.now);

  await runGa4Report(
    {
      propertyId: input.propertyId,
      accessToken: input.accessToken,
      env: input.env,
      fetchImpl: input.fetchImpl
    },
    {
      dateRanges: [{ startDate: today, endDate: today }],
      metrics: [{ name: "sessions" }],
      limit: 1
    }
  );
}

async function runPopularPagesReport(input: {
  propertyId: string;
  accessToken: string;
  env: Ga4Environment;
  fetchImpl: typeof fetch;
  snapshot: SiteSnapshot;
  startDate: string;
  endDate: string;
}) {
  const data = await runGa4Report(
    {
      propertyId: input.propertyId,
      accessToken: input.accessToken,
      env: input.env,
      fetchImpl: input.fetchImpl
    },
    {
      dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "sessions" }],
      orderBys: [
        {
          metric: {
            metricName: "sessions"
          },
          desc: true
        }
      ],
      limit: 10
    }
  );

  return mapPopularPagesFromGa4(data, input.snapshot);
}

async function runGa4Report(
  config: {
    propertyId: string;
    accessToken: string;
    env: Ga4Environment;
    fetchImpl: typeof fetch;
  },
  body: Record<string, unknown>
) {
  const response = await config.fetchImpl(
    `${config.env.GA4_API_BASE_URL}/properties/${config.propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    throw new Error(`GA4 report request failed with status ${response.status}.`);
  }

  return (await response.json()) as Ga4RunReportResponse;
}

function mapPopularPagesFromGa4(data: Ga4RunReportResponse, snapshot: SiteSnapshot) {
  const rows = data.rows ?? [];
  const pageMap = createPagePathMap(snapshot);
  const pageStats = new Map<SitePageKey, { pageKey: SitePageKey; title: string; visits: number }>();

  for (const row of rows) {
    const pagePath = row.dimensionValues?.[0]?.value ?? "";
    const visits = parseMetricValue(row.metricValues?.[0]?.value);
    const matchedPage = pageMap.get(pagePath);

    if (!matchedPage) {
      continue;
    }

    const current = pageStats.get(matchedPage.pageKey);
    pageStats.set(matchedPage.pageKey, {
      pageKey: matchedPage.pageKey,
      title: matchedPage.title,
      visits: (current?.visits ?? 0) + visits
    });
  }

  return Array.from(pageStats.values())
    .sort((left, right) => right.visits - left.visits)
    .slice(0, 5);
}

function createPagePathMap(snapshot: SiteSnapshot) {
  const pageMap = new Map<string, { pageKey: SitePageKey; title: string }>();

  for (const page of snapshot.pages) {
    pageMap.set(pathForPage(page.key), {
      pageKey: page.key,
      title: page.title
    });
  }

  return pageMap;
}

function pathForPage(pageKey: SitePageKey) {
  switch (pageKey) {
    case "home":
      return "/";
    case "about":
      return "/about";
    case "services":
      return "/services";
    case "contact":
      return "/contact";
    case "news":
      return "/news";
    default:
      return "/";
  }
}

function parseMetricValue(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildMonthRanges(now: Date) {
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const previousMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));

  return {
    currentMonthRange: {
      startDate: toDateString(currentMonthStart),
      endDate: toDateString(now)
    },
    previousMonthRange: {
      startDate: toDateString(previousMonthStart),
      endDate: toDateString(previousMonthEnd)
    },
    currentMonthLabel: formatMonthLabel(now),
    previousMonthLabel: formatMonthLabel(previousMonthStart)
  };
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    timeZone: "UTC"
  }).format(date);
}
