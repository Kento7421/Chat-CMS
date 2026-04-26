import { z } from "zod";
import type { SitePageKey } from "@/types/domain";

const sitePageKeySchema: z.ZodType<SitePageKey> = z.enum([
  "home",
  "about",
  "services",
  "contact",
  "news"
]);

export const analyticsPopularPageSchema = z.object({
  pageKey: sitePageKeySchema,
  title: z.string().trim().min(1),
  visits: z.number().int().nonnegative()
});

export const analyticsSiteConfigSchema = z.object({
  provider: z.enum(["fallback", "ga4"]),
  ga4PropertyId: z.string().trim().min(1).nullable()
});

export const analyticsSettingsUpdateInputSchema = z.object({
  siteId: z.string().uuid(),
  provider: z.enum(["fallback", "ga4"]),
  ga4PropertyId: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null))
});

export const analyticsConnectionCheckInputSchema = z.object({
  siteId: z.string().uuid()
});

export const analyticsConnectionStatusCodeSchema = z.enum([
  "ok",
  "provider_not_ga4",
  "property_missing",
  "env_missing",
  "token_failed",
  "report_failed"
]);

export const analyticsConnectionCheckResultSchema = z.object({
  ok: z.boolean(),
  code: analyticsConnectionStatusCodeSchema,
  message: z.string().trim().min(1),
  checkedAt: z.string().datetime(),
  propertyId: z.string().trim().min(1).nullable(),
  provider: z.enum(["fallback", "ga4"])
});

export const analyticsOverviewSchema = z.object({
  source: z.enum(["fallback", "ga4"]),
  generatedAt: z.string().datetime(),
  currentMonthLabel: z.string().trim().min(1),
  previousMonthLabel: z.string().trim().min(1),
  currentMonthVisits: z.number().int().nonnegative(),
  previousMonthVisits: z.number().int().nonnegative(),
  percentChangeFromPreviousMonth: z.number().nullable(),
  popularPages: z.array(analyticsPopularPageSchema).max(5)
});

export type AnalyticsSiteConfig = z.infer<typeof analyticsSiteConfigSchema>;
export type AnalyticsConnectionCheckInput = z.infer<typeof analyticsConnectionCheckInputSchema>;
export type AnalyticsConnectionCheckResult = z.infer<typeof analyticsConnectionCheckResultSchema>;
export type AnalyticsSettingsUpdateInput = z.infer<typeof analyticsSettingsUpdateInputSchema>;
export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;
export type AnalyticsPopularPage = z.infer<typeof analyticsPopularPageSchema>;
