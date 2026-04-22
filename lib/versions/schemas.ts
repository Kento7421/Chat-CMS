import { z } from "zod";

export const versionsQuerySchema = z.object({
  siteId: z.string().uuid().optional()
});

export const rollbackInputSchema = z.object({
  targetVersionId: z.string().uuid()
});

export type RollbackInput = z.infer<typeof rollbackInputSchema>;
