import { z } from "zod";
import type { Json } from "@/types/database";
import type { PublishableChangeSetPayload } from "@/lib/versioning/types";

const jsonValueSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema)
  ])
);

export const snapshotJsonSchema = z.record(jsonValueSchema);

export const publishableChangeSetPayloadSchema: z.ZodType<PublishableChangeSetPayload> =
  z.object({
    basedOnVersionId: z.string().uuid().nullable().optional(),
    proposedSnapshotJson: snapshotJsonSchema
  });
