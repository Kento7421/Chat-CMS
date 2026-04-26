import { aiInterpretationSchema } from "@/lib/chat/schemas";
import {
  buildPendingNewsFollowupQuestion,
  createPendingNewsComposeStateFromMessage,
  isNewsCreateRequest,
  toSuggestedNewsPostDraft
} from "@/lib/chat/news-draft";
import {
  findLikelyEditableTargets,
  normalizeInterpretationTargets,
  resolveTargetLabel
} from "@/lib/chat/targets";
import type {
  AiInterpretationResult,
  ChatAssetOption,
  EditableChatTarget,
  SuggestionOption
} from "@/lib/chat/types";

const unsupportedKeywords = ["layout", "design", "new page", "seo", "analytics", "blog"];
const imageKeywords = ["画像", "写真", "バナー", "hero", "ヒーロー", "メインビジュアル", "トップ画像", "cover"];
function extractQuotedText(message: string) {
  const patterns = [/「([^」]+)」/, /『([^』]+)』/, /"([^"]+)"/, /“([^”]+)”/];

  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function detectFieldHint(message: string) {
  if (message.includes("電話")) {
    return "phone";
  }

  if (message.includes("メール") || message.toLowerCase().includes("email")) {
    return "email";
  }

  if (message.includes("営業時間") || message.includes("営業日")) {
    return "businessHours";
  }

  if (imageKeywords.some((keyword) => message.toLowerCase().includes(keyword.toLowerCase()))) {
    return "imageAssetId";
  }

  if (message.includes("見出し") || message.includes("タイトル")) {
    return "heading";
  }

  if (message.includes("本文") || message.includes("文章") || message.includes("説明")) {
    return "body";
  }

  return null;
}

function detectFactualValue(message: string, fieldHint: string | null) {
  if (fieldHint === "phone") {
    return message.match(/0\d{1,4}-\d{1,4}-\d{3,4}/)?.[0] ?? null;
  }

  if (fieldHint === "email") {
    return message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
  }

  if (fieldHint === "businessHours") {
    return (
      message.match(
        /(?:月曜|火曜|水曜|木曜|金曜|土曜|日曜|平日).{0,24}(?:\d{1,2}:\d{2}.{0,6}\d{1,2}:\d{2}|休業)/
      )?.[0] ?? null
    );
  }

  return null;
}

function makeSuggestion(
  key: string,
  title: string,
  summary: string,
  proposedValue: string,
  reasoning: string,
  target: EditableChatTarget,
  asset?: ChatAssetOption | null
): SuggestionOption {
  return {
    key,
    title,
    summary,
    proposedValue,
    reasoning,
    target: {
      fieldId: target.fieldId,
      fieldLabel: target.fieldLabel,
      page: target.page,
      section: target.section,
      field: target.field
    },
    proposedAsset: asset
      ? {
          id: asset.id,
          label: asset.originalFilename,
          url: asset.publicUrl,
          altText: asset.altText
        }
      : null,
    contentDraft: null
  };
}

function uniqueSuggestions(suggestions: SuggestionOption[]) {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    const normalized = [
      suggestion.proposedValue.trim(),
      suggestion.proposedAsset?.id ?? "",
      suggestion.contentDraft?.title ?? "",
      suggestion.contentDraft?.body ?? ""
    ].join("::");

    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function buildToneSuggestions(target: EditableChatTarget) {
  const current = target.currentValue.trim() || "新しいコピー";

  if (target.field === "heading") {
    return uniqueSuggestions([
      makeSuggestion(
        "option-1",
        "親しみやすく調整",
        `${resolveTargetLabel(target)}をやわらかい表現にします。`,
        `選ばれる理由がすぐに伝わる${current.replace(/\s+/g, "")}`,
        "第一印象で内容が伝わるトーンに寄せます。",
        target
      ),
      makeSuggestion(
        "option-2",
        "信頼感を強める",
        `${resolveTargetLabel(target)}を落ち着いた表現にします。`,
        `${current.replace(/[!！]+$/g, "")}で、安心して相談できる体制を整えています`,
        "中小企業向けサイトで使いやすい信頼感のある書き方です。",
        target
      ),
      makeSuggestion(
        "option-3",
        "短く整理する",
        `${resolveTargetLabel(target)}を簡潔にします。`,
        current.replace(/[!！]+$/g, ""),
        "意味を保ちながら短くして視認性を上げます。",
        target
      )
    ]).slice(0, 3);
  }

  return uniqueSuggestions([
    makeSuggestion(
      "option-1",
      "親しみやすく調整",
      `${resolveTargetLabel(target)}を読みやすく整えます。`,
      `${current.replace(/[!！]+$/g, "")}。お気軽にご相談ください。`,
      "やわらかく問い合わせしやすい印象に寄せます。",
      target
    ),
    makeSuggestion(
      "option-2",
      "信頼感を強める",
      `${resolveTargetLabel(target)}を落ち着いた表現にします。`,
      `${current.replace(/[!！]+$/g, "")}。実務に合わせた丁寧な対応を行っています。`,
      "安心感を伝えやすい標準的な表現です。",
      target
    ),
    makeSuggestion(
      "option-3",
      "短く整理する",
      `${resolveTargetLabel(target)}を簡潔にします。`,
      current.replace(/[!！]+$/g, ""),
      "現在の内容を保ちながら短く整えます。",
      target
    )
  ]).slice(0, 3);
}

function resolveTargetFromMessage(message: string, editableTargets: EditableChatTarget[]) {
  const rankedTargets = findLikelyEditableTargets(message, editableTargets);
  const fieldHint = detectFieldHint(message);

  if (fieldHint) {
    const fieldTargets = editableTargets.filter((target) => target.field === fieldHint);

    if (fieldTargets.length === 1) {
      return fieldTargets[0] ?? null;
    }

    const rankedFieldTargets = rankedTargets.filter((entry) => entry.target.field === fieldHint);

    if (rankedFieldTargets.length === 1) {
      return rankedFieldTargets[0]?.target ?? null;
    }
  }

  const bestTarget = rankedTargets[0];
  const secondTarget = rankedTargets[1];

  if (!bestTarget || bestTarget.score < 4) {
    return null;
  }

  if (secondTarget && secondTarget.score >= bestTarget.score - 1) {
    return null;
  }

  return bestTarget.target;
}

function resolveAssetFromMessage(
  message: string,
  availableAssets: ChatAssetOption[],
  selectedAsset?: ChatAssetOption | null
) {
  if (selectedAsset) {
    return selectedAsset;
  }

  const normalized = message.toLowerCase();
  const matches = availableAssets.filter((asset) => {
    const filename = asset.originalFilename.toLowerCase();
    const altText = asset.altText?.toLowerCase() ?? "";
    return normalized.includes(filename) || (altText !== "" && normalized.includes(altText));
  });

  if (matches.length === 1) {
    return matches[0] ?? null;
  }

  return null;
}

function buildNewsCreateSuggestion(
  title: string,
  body: string,
  imageAsset: ChatAssetOption | null,
  target: EditableChatTarget | null
): SuggestionOption {
  const fallbackTarget = target ?? {
    fieldId: "news.news-intro.body",
    fieldLabel: "本文",
    page: "news",
    pageLabel: "お知らせ",
    section: "news-intro",
    sectionLabel: "導入",
    field: "body",
    fieldType: "rich_text",
    label: "お知らせ / 導入 / 本文",
    aliases: [],
    currentValue: "",
    currentAssetId: null,
    path: ["pages", "news", "sections", "news-intro", "body"]
  } satisfies EditableChatTarget;

  return {
    key: "option-1",
    title: "この内容でお知らせを作成",
    summary: "承認後にお知らせを公開します。",
    proposedValue: `${title}\n${body}`,
    reasoning: "タイトルと本文が揃っているため、このまま承認待ちに進められます。",
    target: {
      fieldId: fallbackTarget.fieldId,
      fieldLabel: fallbackTarget.fieldLabel,
      page: fallbackTarget.page,
      section: fallbackTarget.section,
      field: fallbackTarget.field
    },
    proposedAsset: imageAsset
      ? {
          id: imageAsset.id,
          label: imageAsset.originalFilename,
          url: imageAsset.publicUrl,
          altText: imageAsset.altText
        }
      : null,
    contentDraft: {
      kind: "news_post",
      title,
      body,
      imageAssetId: imageAsset?.id ?? null,
      imageUrl: imageAsset?.publicUrl ?? null,
      imageAltText: imageAsset?.altText ?? null,
      publishedAt: new Date().toISOString()
    }
  };
}

function buildNewsCreateInterpretation(
  message: string,
  editableTargets: EditableChatTarget[],
  selectedAsset: ChatAssetOption | null,
  availableAssets: ChatAssetOption[]
) {
  const imageAsset = resolveAssetFromMessage(message, availableAssets, selectedAsset);
  const newsTarget =
    editableTargets.find((target) => target.page === "news" && target.section === "news-intro") ?? null;
  const state = createPendingNewsComposeStateFromMessage({
    message,
    selectedAsset: imageAsset
  });

  if (state.missingFields.length > 0) {

    return aiInterpretationSchema.parse({
      flowAction: "ask_followup",
      intent: {
        action_type: "clarify_request",
        intent_category: "content_create",
        confidence: 0.74,
        target_page: "news",
        target_section: "news-intro",
        target_field: "body",
        needs_confirmation: false,
        needs_more_input: true,
        user_message: message,
        assistant_message: "お知らせ作成に必要な情報がまだ揃っていません。"
      },
      followupQuestion: buildPendingNewsFollowupQuestion(state),
      rejectionReason: null,
      suggestions: []
    });
  }

  const draft = toSuggestedNewsPostDraft(state);

  if (!draft) {
    return aiInterpretationSchema.parse({
      flowAction: "ask_followup",
      intent: {
        action_type: "clarify_request",
        intent_category: "content_create",
        confidence: 0.7,
        target_page: "news",
        target_section: "news-intro",
        target_field: "body",
        needs_confirmation: false,
        needs_more_input: true,
        user_message: message,
        assistant_message: "お知らせ作成に必要な情報がまだ揃っていません。"
      },
      followupQuestion: buildPendingNewsFollowupQuestion(state),
      rejectionReason: null,
      suggestions: []
    });
  }

  return aiInterpretationSchema.parse({
    flowAction: "suggest_options",
    intent: {
      action_type: "content_create",
      intent_category: "content_create",
      confidence: 0.9,
      target_page: "news",
      target_section: "news-intro",
      target_field: "body",
      needs_confirmation: true,
      needs_more_input: false,
      user_message: message,
      assistant_message: "お知らせ作成の候補を作成しました。内容を確認して承認してください。"
    },
    followupQuestion: null,
    rejectionReason: null,
    suggestions: [
      {
        ...buildNewsCreateSuggestion(draft.title, draft.body, imageAsset, newsTarget),
        contentDraft: draft
      }
    ]
  });
}

export function interpretChatRequestHeuristically(
  message: string,
  editableTargets: EditableChatTarget[],
  options?: {
    selectedAsset?: ChatAssetOption | null;
    availableAssets?: ChatAssetOption[];
  }
): AiInterpretationResult {
  const normalizedMessage = message.trim();
  const lowered = normalizedMessage.toLowerCase();
  const availableAssets = options?.availableAssets ?? [];
  const selectedAsset = options?.selectedAsset ?? null;

  if (unsupportedKeywords.some((keyword) => lowered.includes(keyword.toLowerCase()))) {
    return aiInterpretationSchema.parse({
      flowAction: "reject_request",
      intent: {
        action_type: "reject_request",
        intent_category: "unsupported_request",
        confidence: 0.92,
        target_page: null,
        target_section: null,
        target_field: null,
        needs_confirmation: false,
        needs_more_input: false,
        user_message: normalizedMessage,
        assistant_message:
          "この依頼は現在のチャット更新MVPでは扱えません。文言変更、連絡先更新、画像差し替え、お知らせ作成の範囲で指定してください。"
      },
      followupQuestion: null,
      rejectionReason:
        "現在のチャット更新では、文言変更・事実変更・画像差し替え・お知らせ作成に絞って対応しています。",
      suggestions: []
    });
  }

  if (isNewsCreateRequest(normalizedMessage)) {
    return normalizeInterpretationTargets(
      buildNewsCreateInterpretation(normalizedMessage, editableTargets, selectedAsset, availableAssets),
      editableTargets
    );
  }

  const resolvedTarget = resolveTargetFromMessage(normalizedMessage, editableTargets);
  const fieldHint = detectFieldHint(normalizedMessage);
  const explicitValue = extractQuotedText(normalizedMessage);
  const factualValue = detectFactualValue(normalizedMessage, fieldHint);
  const resolvedAsset = resolveAssetFromMessage(normalizedMessage, availableAssets, selectedAsset);

  if (!resolvedTarget) {
    return aiInterpretationSchema.parse({
      flowAction: "ask_followup",
      intent: {
        action_type: "clarify_request",
        intent_category: fieldHint === "imageAssetId" ? "asset_update" : "expression_update",
        confidence: 0.42,
        target_page: null,
        target_section: null,
        target_field: fieldHint,
        needs_confirmation: false,
        needs_more_input: true,
        user_message: normalizedMessage,
        assistant_message:
          "変更したい場所を特定できませんでした。ページ名やセクション名もあわせて教えてください。"
      },
      followupQuestion:
        fieldHint === "imageAssetId"
          ? "どの画像を変更したいですか。例: トップページのメイン画像をこの画像に変更"
          : "どのページのどの文言を変更したいか、ページ名か見出し名も含めて教えてください。",
      rejectionReason: null,
      suggestions: []
    });
  }

  if (resolvedTarget.field === "imageAssetId") {
    if (!resolvedAsset) {
      return aiInterpretationSchema.parse({
        flowAction: "ask_followup",
        intent: {
          action_type: "clarify_request",
          intent_category: "asset_update",
          confidence: 0.6,
          target_page: resolvedTarget.page,
          target_section: resolvedTarget.section,
          target_field: resolvedTarget.field,
          needs_confirmation: false,
          needs_more_input: true,
          user_message: normalizedMessage,
          assistant_message:
            "画像の差し替え先は分かりましたが、使う画像を特定できませんでした。"
        },
        followupQuestion:
          "使いたい画像を選択するかアップロードしてから、もう一度依頼してください。",
        rejectionReason: null,
        suggestions: []
      });
    }

    return normalizeInterpretationTargets(
      aiInterpretationSchema.parse({
        flowAction: "suggest_options",
        intent: {
          action_type: "asset_update",
          intent_category: "asset_update",
          confidence: 0.91,
          target_page: resolvedTarget.page,
          target_section: resolvedTarget.section,
          target_field: resolvedTarget.field,
          needs_confirmation: true,
          needs_more_input: false,
          user_message: normalizedMessage,
          assistant_message: "画像差し替え候補を用意しました。見た目を確認して選択してください。"
        },
        followupQuestion: null,
        rejectionReason: null,
        suggestions: [
          makeSuggestion(
            "option-1",
            "この画像に差し替える",
            `${resolveTargetLabel(resolvedTarget)}を選択中の画像に更新します。`,
            resolvedAsset.originalFilename,
            "指定された画像で差し替える最短ルートです。",
            resolvedTarget,
            resolvedAsset
          )
        ]
      }),
      editableTargets
    );
  }

  if (factualValue) {
    return normalizeInterpretationTargets(
      aiInterpretationSchema.parse({
        flowAction: "suggest_options",
        intent: {
          action_type: "text_update",
          intent_category: "factual_update",
          confidence: 0.9,
          target_page: resolvedTarget.page,
          target_section: resolvedTarget.section,
          target_field: resolvedTarget.field,
          needs_confirmation: true,
          needs_more_input: false,
          user_message: normalizedMessage,
          assistant_message: `${resolveTargetLabel(resolvedTarget)}の更新候補を作成しました。`
        },
        followupQuestion: null,
        rejectionReason: null,
        suggestions: [
          makeSuggestion(
            "option-1",
            "この内容で更新",
            `${resolveTargetLabel(resolvedTarget)}を指定値に更新します。`,
            factualValue,
            "依頼文に含まれる事実値をそのまま反映します。",
            resolvedTarget
          )
        ]
      }),
      editableTargets
    );
  }

  if (explicitValue) {
    return normalizeInterpretationTargets(
      aiInterpretationSchema.parse({
        flowAction: "suggest_options",
        intent: {
          action_type: "text_update",
          intent_category: "expression_update",
          confidence: 0.85,
          target_page: resolvedTarget.page,
          target_section: resolvedTarget.section,
          target_field: resolvedTarget.field,
          needs_confirmation: true,
          needs_more_input: false,
          user_message: normalizedMessage,
          assistant_message: "指定された文言を使って候補を作成しました。"
        },
        followupQuestion: null,
        rejectionReason: null,
        suggestions: [
          makeSuggestion(
            "option-1",
            "指定文言で更新",
            `${resolveTargetLabel(resolvedTarget)}を指定文言に更新します。`,
            explicitValue,
            "依頼文で明示されたテキストをそのまま使います。",
            resolvedTarget
          )
        ]
      }),
      editableTargets
    );
  }

  return normalizeInterpretationTargets(
    aiInterpretationSchema.parse({
      flowAction: "suggest_options",
      intent: {
        action_type: "text_update",
        intent_category: "expression_update",
        confidence: 0.7,
        target_page: resolvedTarget.page,
        target_section: resolvedTarget.section,
        target_field: resolvedTarget.field,
        needs_confirmation: true,
        needs_more_input: false,
        user_message: normalizedMessage,
        assistant_message:
          "表現違いの候補を用意しました。近いものを選んでから公開前プレビューを確認できます。"
      },
      followupQuestion: null,
      rejectionReason: null,
      suggestions: buildToneSuggestions(resolvedTarget)
    }),
    editableTargets
  );
}
