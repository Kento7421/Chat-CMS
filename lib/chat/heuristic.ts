import { aiInterpretationSchema } from "@/lib/chat/schemas";
import {
  findLikelyEditableTargets,
  normalizeInterpretationTargets,
  resolveTargetLabel
} from "@/lib/chat/targets";
import type { AiInterpretationResult, EditableChatTarget, SuggestionOption } from "@/lib/chat/types";

const unsupportedKeywords = [
  "レイアウト",
  "デザインを変",
  "新しいページ",
  "多言語",
  "seo",
  "採用ページ",
  "フォームを追加",
  "ブログ機能"
];

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

  if (message.includes("見出し") || message.includes("タイトル")) {
    return "heading";
  }

  if (message.includes("本文") || message.includes("説明") || message.includes("紹介")) {
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
        /(?:平日|土日|月|火|水|木|金|土|日).{0,24}(?:\d{1,2}:\d{2}.{0,6}\d{1,2}:\d{2}|休業)/
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
  target: EditableChatTarget
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
    }
  };
}

function uniqueSuggestions(suggestions: SuggestionOption[]) {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    const normalized = suggestion.proposedValue.trim();

    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function buildToneSuggestions(message: string, target: EditableChatTarget) {
  const current = target.currentValue.trim() || "新しい文案";

  if (target.field === "heading") {
    return uniqueSuggestions([
      makeSuggestion(
        "option-1",
        "親しみやすい案",
        `${resolveTargetLabel(target)}をやわらかく整えます。`,
        `安心して相談できる${current.replace(/\s+/g, "")}`,
        "はじめての方にも伝わりやすい表現です。",
        target
      ),
      makeSuggestion(
        "option-2",
        "信頼感のある案",
        `${resolveTargetLabel(target)}を落ち着いた表現にします。`,
        `${current.replace(/[。.!！]+$/g, "")}で、確かな対応をお届けします`,
        "信頼感を出しやすい文案です。",
        target
      ),
      makeSuggestion(
        "option-3",
        "短くまとめる案",
        `${resolveTargetLabel(target)}を簡潔にします。`,
        current.replace(/[。.!！]+$/g, ""),
        "現在の意味を大きく変えずに短くまとめます。",
        target
      )
    ]).slice(0, 3);
  }

  const friendlyTail = "お気軽にご相談いただけます。";
  const trustTail = "丁寧で分かりやすい対応を大切にしています。";

  return uniqueSuggestions([
    makeSuggestion(
      "option-1",
      "親しみやすい文案",
      `${resolveTargetLabel(target)}をやわらかく整えます。`,
      `${current.replace(/[。.!！]*$/g, "")}。${friendlyTail}`,
      "問い合わせしやすい印象を作りやすい案です。",
      target
    ),
    makeSuggestion(
      "option-2",
      "信頼感のある文案",
      `${resolveTargetLabel(target)}を信頼感寄りに整えます。`,
      `${current.replace(/[。.!！]*$/g, "")}。${trustTail}`,
      "誠実さを伝えたい場面に向く案です。",
      target
    ),
    makeSuggestion(
      "option-3",
      "短めの文案",
      `${resolveTargetLabel(target)}を短くまとめます。`,
      current.replace(/[。.!！]*$/g, ""),
      message.includes("短く") || message.includes("簡潔")
        ? "短くしたい要望に寄せた案です。"
        : "今の表現に近い短めの案です。",
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

export function interpretChatRequestHeuristically(
  message: string,
  editableTargets: EditableChatTarget[]
): AiInterpretationResult {
  const normalizedMessage = message.trim();
  const lowered = normalizedMessage.toLowerCase();

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
          "この依頼は現在のチャット更新では扱えません。文言変更、電話番号、メールアドレス、営業時間の更新から進めてください。"
      },
      followupQuestion: null,
      rejectionReason:
        "現在のチャット更新は文言変更の最小フローに限定しています。レイアウト変更や新規ページ追加はまだ対応していません。",
      suggestions: []
    });
  }

  const resolvedTarget = resolveTargetFromMessage(normalizedMessage, editableTargets);
  const fieldHint = detectFieldHint(normalizedMessage);
  const explicitValue = extractQuotedText(normalizedMessage);
  const factualValue = detectFactualValue(normalizedMessage, fieldHint);

  if (!resolvedTarget) {
    return aiInterpretationSchema.parse({
      flowAction: "ask_followup",
      intent: {
        action_type: "clarify_request",
        intent_category:
          fieldHint === "phone" || fieldHint === "email" || fieldHint === "businessHours"
            ? "factual_update"
            : "expression_update",
        confidence: 0.44,
        target_page: null,
        target_section: null,
        target_field: fieldHint,
        needs_confirmation: false,
        needs_more_input: true,
        user_message: normalizedMessage,
        assistant_message:
          "更新先を一意に特定できませんでした。ページ名と、見出しか本文かをもう少し具体的に教えてください。"
      },
      followupQuestion:
        "例: 「トップページの見出しを変更したい」「お問い合わせページの電話番号を03-1234-5678にしたい」",
      rejectionReason: null,
      suggestions: []
    });
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
          assistant_message: `${resolveTargetLabel(resolvedTarget)}の更新候補を用意しました。内容を確認して選んでください。`
        },
        followupQuestion: null,
        rejectionReason: null,
        suggestions: [
          makeSuggestion(
            "option-1",
            "この内容で更新",
            `${resolveTargetLabel(resolvedTarget)}を指定の値に変更します。`,
            factualValue,
            "明確な事実変更としてそのまま確認に進める案です。",
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
          assistant_message: "指定された文言で更新する候補を作成しました。確認して進めてください。"
        },
        followupQuestion: null,
        rejectionReason: null,
        suggestions: [
          makeSuggestion(
            "option-1",
            "指定文言で更新",
            `${resolveTargetLabel(resolvedTarget)}を指定された文言に変更します。`,
            explicitValue,
            "依頼文の文言をそのまま使う案です。",
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
          "候補を2〜3案用意しました。近いものを選んで、そのあとで必要なら微調整できます。"
      },
      followupQuestion: null,
      rejectionReason: null,
      suggestions: buildToneSuggestions(normalizedMessage, resolvedTarget)
    }),
    editableTargets
  );
}
