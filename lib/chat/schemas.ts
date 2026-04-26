import { z } from "zod";
import { snapshotJsonSchema } from "@/lib/versioning";
import type {
  AiInterpretationIntent,
  AiInterpretationResult,
  ChangePreviewItem,
  PendingChangeSetView,
  PendingNewsComposeState,
  SuggestedNewsPostDraft,
  SuggestedAssetPayload,
  SuggestionOption,
  SuggestionSetPayload,
  SupportedTargetField
} from "@/lib/chat/types";
import type { ChangeIntentCategory, SitePageKey, SiteSnapshot } from "@/types/domain";
import type { Json } from "@/types/database";

const sitePageKeySchema = z.enum(["home", "about", "services", "contact", "news"]);
const intentCategorySchema = z.enum([
  "expression_update",
  "factual_update",
  "asset_update",
  "content_create",
  "unsupported_request"
]);
const supportedTargetFieldSchema: z.ZodType<SupportedTargetField> = z.enum([
  "heading",
  "body",
  "phone",
  "email",
  "businessHours",
  "imageAssetId"
]);

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

export const chatInterpretInputSchema = z.object({
  siteId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  message: z
    .string()
    .trim()
    .min(1, "メッセージを入力してください。")
    .max(1000, "メッセージは1000文字以内で入力してください。")
});

export const chatSelectSuggestionInputSchema = z.object({
  suggestionSetId: z.string().uuid(),
  suggestionKey: z.string().trim().min(1, "選択する候補を指定してください。")
});

export const chatConfirmInputSchema = z.object({
  changeSetId: z.string().uuid()
});

export const chatTargetReferenceSchema = z.object({
  fieldId: z.string().trim().min(1).nullable().optional(),
  fieldLabel: z.string().trim().min(1).nullable().optional(),
  page: sitePageKeySchema.nullable(),
  section: z.string().trim().min(1).nullable(),
  field: supportedTargetFieldSchema.nullable()
});

export const suggestedAssetPayloadSchema: z.ZodType<SuggestedAssetPayload> = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1),
  url: z.string().url().nullable(),
  altText: z.string().trim().nullable()
});

export const suggestedNewsPostDraftSchema: z.ZodType<SuggestedNewsPostDraft> = z.object({
  kind: z.literal("news_post"),
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(10000),
  imageAssetId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  imageAltText: z.string().trim().nullable().optional(),
  publishedAt: z.string().datetime().optional()
});

export const pendingNewsComposeStateSchema: z.ZodType<PendingNewsComposeState> = z.object({
  kind: z.literal("news_post_draft"),
  title: z.string().trim().nullable(),
  body: z.string().trim().nullable(),
  imageRequested: z.boolean(),
  imageAssetId: z.string().uuid().nullable(),
  imageUrl: z.string().url().nullable(),
  imageAltText: z.string().trim().nullable(),
  missingFields: z.array(z.enum(["title", "body", "image"]))
});

export const suggestionOptionSchema: z.ZodType<SuggestionOption> = z.object({
  key: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  proposedValue: z.string().trim().min(1),
  reasoning: z.string().trim().min(1),
  target: chatTargetReferenceSchema,
  proposedAsset: suggestedAssetPayloadSchema.nullable().optional(),
  contentDraft: suggestedNewsPostDraftSchema.nullable().optional()
});

export const suggestionSetPayloadSchema: z.ZodType<SuggestionSetPayload> = z.object({
  suggestions: z.array(suggestionOptionSchema).min(1).max(3)
});

export const aiInterpretationIntentSchema: z.ZodType<AiInterpretationIntent> = z.object({
  action_type: z.enum([
    "text_update",
    "asset_update",
    "content_create",
    "clarify_request",
    "reject_request"
  ]),
  intent_category: intentCategorySchema,
  confidence: z.number().min(0).max(1),
  target_page: sitePageKeySchema.nullable(),
  target_section: z.string().trim().min(1).nullable(),
  target_field: supportedTargetFieldSchema.nullable(),
  needs_confirmation: z.boolean(),
  needs_more_input: z.boolean(),
  user_message: z.string().trim().min(1),
  assistant_message: z.string().trim().min(1)
});

export const aiInterpretationSchema: z.ZodType<AiInterpretationResult> = z.object({
  flowAction: z.enum(["suggest_options", "ask_followup", "reject_request"]),
  intent: aiInterpretationIntentSchema,
  followupQuestion: z.string().trim().min(1).nullable(),
  rejectionReason: z.string().trim().min(1).nullable(),
  suggestions: z.array(suggestionOptionSchema).max(3)
});

export const chatAiResponseJsonSchema = {
  name: "chat_cms_interpretation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      flowAction: {
        type: "string",
        enum: ["suggest_options", "ask_followup", "reject_request"]
      },
      intent: {
        type: "object",
        additionalProperties: false,
        properties: {
          action_type: {
            type: "string",
            enum: [
              "text_update",
              "asset_update",
              "content_create",
              "clarify_request",
              "reject_request"
            ]
          },
          intent_category: {
            type: "string",
            enum: [
              "expression_update",
              "factual_update",
              "asset_update",
              "content_create",
              "unsupported_request"
            ]
          },
          confidence: {
            type: "number"
          },
          target_page: {
            type: ["string", "null"],
            enum: ["home", "about", "services", "contact", "news", null]
          },
          target_section: {
            type: ["string", "null"]
          },
          target_field: {
            type: ["string", "null"],
            enum: ["heading", "body", "phone", "email", "businessHours", "imageAssetId", null]
          },
          needs_confirmation: {
            type: "boolean"
          },
          needs_more_input: {
            type: "boolean"
          },
          user_message: {
            type: "string"
          },
          assistant_message: {
            type: "string"
          }
        },
        required: [
          "action_type",
          "intent_category",
          "confidence",
          "target_page",
          "target_section",
          "target_field",
          "needs_confirmation",
          "needs_more_input",
          "user_message",
          "assistant_message"
        ]
      },
      followupQuestion: {
        type: ["string", "null"]
      },
      rejectionReason: {
        type: ["string", "null"]
      },
      suggestions: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            proposedValue: { type: "string" },
            reasoning: { type: "string" },
            target: {
              type: "object",
              additionalProperties: false,
              properties: {
                fieldId: {
                  type: ["string", "null"]
                },
                fieldLabel: {
                  type: ["string", "null"]
                },
                page: {
                  type: ["string", "null"],
                  enum: ["home", "about", "services", "contact", "news", null]
                },
                section: {
                  type: ["string", "null"]
                },
                field: {
                  type: ["string", "null"],
                  enum: ["heading", "body", "phone", "email", "businessHours", "imageAssetId", null]
                }
              },
              required: ["fieldId", "fieldLabel", "page", "section", "field"]
            },
            proposedAsset: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                    url: { type: ["string", "null"] },
                    altText: { type: ["string", "null"] }
                  },
                  required: ["id", "label", "url", "altText"]
                }
              ]
            },
            contentDraft: {
              anyOf: [
                { type: "null" },
                {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    kind: { type: "string", enum: ["news_post"] },
                    id: { type: "string" },
                    title: { type: "string" },
                    body: { type: "string" },
                    imageAssetId: { type: ["string", "null"] },
                    imageUrl: { type: ["string", "null"] },
                    imageAltText: { type: ["string", "null"] },
                    publishedAt: { type: "string" }
                  },
                  required: [
                    "kind",
                    "title",
                    "body",
                    "imageAssetId",
                    "imageUrl",
                    "imageAltText",
                    "publishedAt"
                  ]
                }
              ]
            }
          },
          required: [
            "key",
            "title",
            "summary",
            "proposedValue",
            "reasoning",
            "target",
            "proposedAsset",
            "contentDraft"
          ]
        }
      }
    },
    required: ["flowAction", "intent", "followupQuestion", "rejectionReason", "suggestions"]
  }
} as const;

export const chatChangeSetPayloadSchema = z.object({
  basedOnVersionId: z.string().uuid().nullable().optional(),
  proposedSnapshotJson: snapshotJsonSchema,
  selectedSuggestionKey: z.string().trim().min(1).optional(),
  suggestionSetId: z.string().uuid().optional(),
  pendingNewsPost: suggestedNewsPostDraftSchema.optional(),
  previewDiff: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        summary: z.string().trim().min(1),
        beforeValue: jsonValueSchema.nullable(),
        afterValue: jsonValueSchema.nullable()
      })
    )
    .optional()
});

export const changePreviewItemSchema: z.ZodType<ChangePreviewItem> = z.object({
  id: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  beforeValue: jsonValueSchema.nullable(),
  afterValue: jsonValueSchema.nullable()
});

export const pendingChangeSetViewSchema: z.ZodType<PendingChangeSetView> = z.object({
  id: z.string().uuid(),
  status: z.enum([
    "draft",
    "awaiting_confirmation",
    "approved",
    "applied",
    "rejected",
    "cancelled"
  ]),
  summary: z.string().nullable(),
  basedOnVersionId: z.string().uuid().nullable(),
  previewDiff: z.array(changePreviewItemSchema),
  preview: z.object({
    pages: z.array(
      z.object({
        pageKey: sitePageKeySchema,
        pageTitle: z.string().trim().min(1),
        sections: z.array(
          z.object({
            sectionId: z.string().trim().min(1),
            sectionLabel: z.string().trim().min(1),
            changedFields: z.array(z.string().trim().min(1)),
            before: z.object({
              heading: z.string(),
              body: z.string(),
              contactLines: z.array(z.string()),
              image: z
                .object({
                  assetId: z.string().uuid().nullable(),
                  src: z.string().nullable(),
                  alt: z.string()
                })
                .nullable(),
              newsItems: z.array(
                z.object({
                  id: z.string().uuid(),
                  title: z.string(),
                  body: z.string(),
                  publishedAt: z.string(),
                  imageAssetId: z.string().uuid().nullable().optional()
                })
              )
            }),
            after: z.object({
              heading: z.string(),
              body: z.string(),
              contactLines: z.array(z.string()),
              image: z
                .object({
                  assetId: z.string().uuid().nullable(),
                  src: z.string().nullable(),
                  alt: z.string()
                })
                .nullable(),
              newsItems: z.array(
                z.object({
                  id: z.string().uuid(),
                  title: z.string(),
                  body: z.string(),
                  publishedAt: z.string(),
                  imageAssetId: z.string().uuid().nullable().optional()
                })
              )
            })
          })
        )
      })
    )
  }),
  proposedSnapshotJson: snapshotJsonSchema as unknown as z.ZodType<SiteSnapshot>
});

export function normalizeTargetPage(
  value: SitePageKey | null | undefined
): SitePageKey | null {
  return value ?? null;
}

export function normalizeIntentCategory(
  value: ChangeIntentCategory | null | undefined
): ChangeIntentCategory {
  return value ?? "expression_update";
}
