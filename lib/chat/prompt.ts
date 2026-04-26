import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ChatAssetOption, ChatMessageView, EditableChatTarget } from "@/lib/chat/types";
import type { SiteSnapshot } from "@/types/domain";

let cachedRequirementsDocument: string | null = null;

async function loadRequirementsDocument() {
  if (cachedRequirementsDocument) {
    return cachedRequirementsDocument;
  }

  const filePath = path.join(process.cwd(), "docs", "requirements.md");
  cachedRequirementsDocument = await readFile(filePath, "utf8");
  return cachedRequirementsDocument;
}

function formatTargets(targets: EditableChatTarget[]) {
  return targets
    .map(
      (target, index) =>
        `${index + 1}. fieldId=${target.fieldId} page=${target.page} pageLabel=${target.pageLabel} section=${target.section} sectionLabel=${target.sectionLabel} field=${target.field} fieldType=${target.fieldType} fieldLabel=${target.fieldLabel} label=${target.label} aliases=${target.aliases.join("|")} current=${JSON.stringify(target.currentValue)} currentAssetId=${target.currentAssetId ?? "null"}`
    )
    .join("\n");
}

function formatMessages(messages: ChatMessageView[]) {
  return messages
    .slice(-6)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
}

function formatAssets(assets: ChatAssetOption[]) {
  return assets
    .map(
      (asset, index) =>
        `${index + 1}. id=${asset.id} filename=${asset.originalFilename} alt=${asset.altText ?? ""} url=${asset.publicUrl ?? ""}`
    )
    .join("\n");
}

export async function buildChatMasterPrompt(input: {
  userMessage: string;
  snapshot: SiteSnapshot;
  editableTargets: EditableChatTarget[];
  recentMessages: ChatMessageView[];
  selectedAsset?: ChatAssetOption | null;
  availableAssets: ChatAssetOption[];
}) {
  const requirements = await loadRequirementsDocument();

  return [
    "You are the chat interpretation engine for a Japanese MVP chat CMS.",
    "Follow docs/requirements.md as the product source of truth.",
    "Only support text updates, image replacement, and news post creation in this task.",
    "Do not propose layout edits, SEO strategy, or new page generation.",
    "Allowed flow actions are suggest_options, ask_followup, reject_request.",
    "If the request is ambiguous but still within supported updates, ask a follow-up question.",
    "If the request is a clear factual update like phone/email/business hours, return a suggestion that reflects the factual value exactly.",
    "If the request is an image replacement, only target editable image fields and only use the selected asset or one of the available assets listed below.",
    "If the request is creating a news post, use contentDraft with kind=news_post and include title/body. Include imageAssetId only when an actual asset is selected or matched.",
    "Never invent a target outside the editable target list.",
    "Never invent an asset id outside the selected/available asset list.",
    "For text suggestions, set proposedAsset to null.",
    "For asset suggestions, set proposedAsset to the actual asset object.",
    "For news creation suggestions, set contentDraft and set target to page=news, section=news-intro, field=body.",
    "Respond in Japanese.",
    "",
    "Requirements document:",
    requirements,
    "",
    "Current snapshot summary:",
    JSON.stringify(
      {
        siteName: input.snapshot.siteName,
        contact: input.snapshot.contact,
        pages: input.snapshot.pages.map((page) => ({
          key: page.key,
          title: page.title,
          sections: page.sections.map((section) => ({
            id: section.id,
            heading: section.heading,
            body: section.body,
            imageAssetId: section.imageAssetId ?? null
          }))
        })),
        assets: input.snapshot.assets
      },
      null,
      2
    ),
    "",
    "Editable targets:",
    formatTargets(input.editableTargets),
    "",
    "Selected asset:",
    input.selectedAsset
      ? JSON.stringify(input.selectedAsset, null, 2)
      : "none",
    "",
    "Available assets:",
    formatAssets(input.availableAssets),
    "",
    "Recent chat history:",
    formatMessages(input.recentMessages),
    "",
    `Latest user message: ${input.userMessage}`
  ].join("\n");
}
