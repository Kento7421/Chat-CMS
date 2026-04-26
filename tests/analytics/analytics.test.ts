import { describe, expect, it } from "vitest";
import { checkGa4Connection } from "@/lib/analytics/ga4";
import {
  buildFallbackAnalyticsOverview,
  calculatePercentChange,
  createAnalyticsSiteConfig,
  shouldUseGa4Provider
} from "@/lib/analytics/service";
import { analyticsOverviewSchema } from "@/lib/analytics/schemas";
import type { SiteSnapshot } from "@/types/domain";

function createSnapshot(): SiteSnapshot {
  return {
    schemaVersion: "2026-04-23",
    templateVersion: "simple-corporate-v1",
    siteId: "11111111-1111-4111-8111-111111111111",
    templateId: "22222222-2222-4222-8222-222222222222",
    siteName: "Demo Company",
    navigation: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
      { label: "News", href: "/news" },
      { label: "Contact", href: "/contact" }
    ],
    theme: {
      accentColor: "#0f766e",
      backgroundColor: "#f8f5ef",
      textColor: "#101828"
    },
    contact: {
      phone: "",
      email: "",
      businessHours: ""
    },
    pages: [
      {
        key: "home",
        title: "トップページ",
        sections: []
      },
      {
        key: "about",
        title: "会社概要",
        sections: []
      },
      {
        key: "news",
        title: "お知らせ",
        sections: []
      },
      {
        key: "contact",
        title: "問い合わせ",
        sections: []
      }
    ],
    news: [],
    assets: [],
    assetIds: []
  };
}

describe("analytics service", () => {
  it("classifies ga4 connection check results safely", async () => {
    const now = new Date("2026-04-23T09:30:00.000Z");
    const fallbackConfig = createAnalyticsSiteConfig({
      analytics_provider: "fallback",
      ga4_property_id: null
    });
    const ga4ConfigWithoutProperty = createAnalyticsSiteConfig({
      analytics_provider: "ga4",
      ga4_property_id: null
    });
    const ga4Config = createAnalyticsSiteConfig({
      analytics_provider: "ga4",
      ga4_property_id: "123456789"
    });

    await expect(
      checkGa4Connection({
        siteConfig: fallbackConfig,
        now,
        env: {
          GA4_TOKEN_URI: "https://oauth2.googleapis.com/token",
          GA4_API_BASE_URL: "https://analyticsdata.googleapis.com/v1beta"
        }
      })
    ).resolves.toMatchObject({ ok: false, code: "provider_not_ga4" });

    await expect(
      checkGa4Connection({
        siteConfig: ga4ConfigWithoutProperty,
        now,
        env: {
          GA4_TOKEN_URI: "https://oauth2.googleapis.com/token",
          GA4_API_BASE_URL: "https://analyticsdata.googleapis.com/v1beta"
        }
      })
    ).resolves.toMatchObject({ ok: false, code: "property_missing" });

    await expect(
      checkGa4Connection({
        siteConfig: ga4Config,
        now,
        env: {
          GA4_TOKEN_URI: "https://oauth2.googleapis.com/token",
          GA4_API_BASE_URL: "https://analyticsdata.googleapis.com/v1beta"
        }
      })
    ).resolves.toMatchObject({ ok: false, code: "env_missing" });

    await expect(
      checkGa4Connection({
        siteConfig: ga4Config,
        now,
        env: {
          GA4_CLIENT_EMAIL: "service@example.com",
          GA4_PRIVATE_KEY: "dummy-private-key",
          GA4_TOKEN_URI: "https://oauth2.googleapis.com/token",
          GA4_API_BASE_URL: "https://analyticsdata.googleapis.com/v1beta"
        },
        accessTokenLoader: async () => {
          throw new Error("token failed");
        }
      })
    ).resolves.toMatchObject({ ok: false, code: "token_failed" });

    await expect(
      checkGa4Connection({
        siteConfig: ga4Config,
        now,
        env: {
          GA4_CLIENT_EMAIL: "service@example.com",
          GA4_PRIVATE_KEY: "dummy-private-key",
          GA4_TOKEN_URI: "https://oauth2.googleapis.com/token",
          GA4_API_BASE_URL: "https://analyticsdata.googleapis.com/v1beta"
        },
        accessTokenLoader: async () => "test-token",
        reportRunner: async () => {
          throw new Error("report failed");
        }
      })
    ).resolves.toMatchObject({ ok: false, code: "report_failed" });

    await expect(
      checkGa4Connection({
        siteConfig: ga4Config,
        now,
        env: {
          GA4_CLIENT_EMAIL: "service@example.com",
          GA4_PRIVATE_KEY: "dummy-private-key",
          GA4_TOKEN_URI: "https://oauth2.googleapis.com/token",
          GA4_API_BASE_URL: "https://analyticsdata.googleapis.com/v1beta"
        },
        accessTokenLoader: async () => "test-token",
        reportRunner: async () => undefined
      })
    ).resolves.toMatchObject({ ok: true, code: "ok" });
  });

  it("normalizes site analytics config and selects ga4 only when ready", () => {
    const siteConfig = createAnalyticsSiteConfig({
      analytics_provider: "ga4",
      ga4_property_id: "123456789"
    });

    expect(siteConfig.provider).toBe("ga4");
    expect(siteConfig.ga4PropertyId).toBe("123456789");
    expect(
      shouldUseGa4Provider({
        siteConfig,
        hasGa4Credentials: true
      })
    ).toBe(true);
    expect(
      shouldUseGa4Provider({
        siteConfig,
        hasGa4Credentials: false
      })
    ).toBe(false);
  });

  it("calculates percent change against the previous month", () => {
    expect(calculatePercentChange(1200, 1000)).toBe(20);
    expect(calculatePercentChange(900, 1000)).toBe(-10);
    expect(calculatePercentChange(500, 0)).toBeNull();
  });

  it("builds fallback analytics from the site snapshot", () => {
    const overview = buildFallbackAnalyticsOverview({
      site: {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Demo Company",
        slug: "demo-company",
        template_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        current_version_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        analytics_provider: "fallback",
        ga4_property_id: null
      },
      snapshot: createSnapshot(),
      now: new Date("2026-04-23T09:30:00.000Z")
    });

    const parsed = analyticsOverviewSchema.parse(overview);

    expect(parsed.source).toBe("fallback");
    expect(parsed.currentMonthLabel).toContain("2026");
    expect(parsed.popularPages).toHaveLength(4);
    expect(parsed.popularPages[0]?.title).toBe("トップページ");
    expect(parsed.popularPages[0]?.visits).toBeGreaterThan(parsed.popularPages[1]?.visits ?? 0);
  });
});
