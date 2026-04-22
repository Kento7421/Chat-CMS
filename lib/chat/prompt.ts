import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ChatMessageView, EditableChatTarget } from "@/lib/chat/types";
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
        `${index + 1}. fieldId=${target.fieldId} page=${target.page} pageLabel=${target.pageLabel} section=${target.section} sectionLabel=${target.sectionLabel} field=${target.field} fieldLabel=${target.fieldLabel} label=${target.label} aliases=${target.aliases.join("|")} current=${JSON.stringify(target.currentValue)}`
    )
    .join("\n");
}

function formatMessages(messages: ChatMessageView[]) {
  return messages
    .slice(-6)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
}

export async function buildChatMasterPrompt(input: {
  userMessage: string;
  snapshot: SiteSnapshot;
  editableTargets: EditableChatTarget[];
  recentMessages: ChatMessageView[];
}) {
  const requirements = await loadRequirementsDocument();

  return [
    "You are the chat interpretation engine for a Japanese MVP chat CMS.",
    "Follow docs/requirements.md as the product source of truth.",
    "Only support text updates in this task. Do not propose layout edits, SEO strategy, or new page generation.",
    "Allowed flow actions are suggest_options, ask_followup, reject_request.",
    "If the request is ambiguous but still within text updates, return 2 or 3 suggestions.",
    "If the request is a clear factual update like phone/email/business hours, return a suggestion that reflects the factual value exactly.",
    "Never invent a target outside the editable target list.",
    "Keep suggestions grounded in the current snapshot and the user's request.",
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
            body: section.body
          }))
        }))
      },
      null,
      2
    ),
    "",
    "Editable targets:",
    formatTargets(input.editableTargets),
    "",
    "Recent chat history:",
    formatMessages(input.recentMessages),
    "",
    `Latest user message: ${input.userMessage}`
  ].join("\n");
}
