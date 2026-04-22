import { z } from "zod";

export const createNewsInputSchema = z.object({
  siteId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(10000),
  imageAssetId: z.string().uuid().nullable().optional(),
  publish: z.boolean().default(true)
});

export type CreateNewsInput = z.infer<typeof createNewsInputSchema>;
