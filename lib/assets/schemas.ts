import { z } from "zod";

export const assetUploadInputSchema = z.object({
  siteId: z.string().uuid(),
  altText: z.string().max(500).nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional()
});
