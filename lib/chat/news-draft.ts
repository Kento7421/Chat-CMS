import type {
  ChatAssetOption,
  PendingNewsComposeField,
  PendingNewsComposeState,
  SuggestedNewsPostDraft
} from "@/lib/chat/types";

const newsKeywords = ["お知らせ", "ニュース", "news", "投稿", "新着"];
const titleLabels = ["タイトル", "title"];
const bodyLabels = ["本文", "body", "内容"];
const imageLabels = ["画像", "image"];
const switchMarkers = [
  "トップページ",
  "ホーム",
  "見出し",
  "電話",
  "メール",
  "営業時間",
  "画像を変えたい",
  "見出しを変えたい"
];

export function isNewsCreateRequest(message: string) {
  return newsKeywords.some((keyword) => message.toLowerCase().includes(keyword.toLowerCase()));
}

export function extractLabeledValue(message: string, labels: string[], stopLabelsInput?: string[]) {
  const lines = message.replace(/\r\n/g, "\n").split("\n");
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  const stopLabels = new Set(
    [...normalizedLabels, ...(stopLabelsInput ?? []), ...imageLabels].map((label) =>
      label.toLowerCase()
    )
  );

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    const separatorIndex = line.search(/[：:]/);

    if (separatorIndex === -1) {
      continue;
    }

    const rawLabel = line.slice(0, separatorIndex).trim().toLowerCase();

    if (!normalizedLabels.includes(rawLabel)) {
      continue;
    }

    const valueLines = [line.slice(separatorIndex + 1).trim()];

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex]?.trim() ?? "";
      const nextSeparatorIndex = nextLine.search(/[：:]/);

      if (nextSeparatorIndex !== -1) {
        const nextLabel = nextLine.slice(0, nextSeparatorIndex).trim().toLowerCase();

        if (stopLabels.has(nextLabel)) {
          break;
        }
      }

      valueLines.push(nextLine);
    }

    const value = valueLines.join("\n").trim();
    return value === "" ? null : value;
  }

  return null;
}

function hasImageSignal(message: string) {
  return imageLabels.some((label) => message.toLowerCase().includes(label.toLowerCase()));
}

export function createPendingNewsComposeStateFromMessage(input: {
  message: string;
  selectedAsset?: ChatAssetOption | null;
}) {
  const allLabels = [...titleLabels, ...bodyLabels];
  const title = extractLabeledValue(input.message, titleLabels, allLabels);
  const body = extractLabeledValue(input.message, bodyLabels, allLabels);

  return createPendingNewsComposeState({
    title,
    body,
    imageRequested: hasImageSignal(input.message),
    selectedAsset: input.selectedAsset ?? null
  });
}

function buildMissingFields(input: {
  title: string | null;
  body: string | null;
  imageRequested: boolean;
  imageAssetId: string | null;
}): PendingNewsComposeField[] {
  const missing: PendingNewsComposeField[] = [];

  if (!input.title) {
    missing.push("title");
  }

  if (!input.body) {
    missing.push("body");
  }

  if (input.imageRequested && !input.imageAssetId) {
    missing.push("image");
  }

  return missing;
}

export function createPendingNewsComposeState(input: {
  title?: string | null;
  body?: string | null;
  imageRequested?: boolean;
  selectedAsset?: ChatAssetOption | null;
}): PendingNewsComposeState {
  const title = input.title?.trim() || null;
  const body = input.body?.trim() || null;
  const imageRequested = input.imageRequested ?? false;
  const selectedAsset = input.selectedAsset ?? null;

  return {
    kind: "news_post_draft",
    title,
    body,
    imageRequested,
    imageAssetId: selectedAsset?.id ?? null,
    imageUrl: selectedAsset?.publicUrl ?? null,
    imageAltText: selectedAsset?.altText ?? null,
    missingFields: buildMissingFields({
      title,
      body,
      imageRequested,
      imageAssetId: selectedAsset?.id ?? null
    })
  };
}

export function toSuggestedNewsPostDraft(state: PendingNewsComposeState): SuggestedNewsPostDraft | null {
  if (state.missingFields.length > 0 || !state.title || !state.body) {
    return null;
  }

  return {
    kind: "news_post",
    id: crypto.randomUUID(),
    title: state.title,
    body: state.body,
    imageAssetId: state.imageAssetId,
    imageUrl: state.imageUrl,
    imageAltText: state.imageAltText,
    publishedAt: new Date().toISOString()
  };
}

export function isLikelyIntentSwitchFromNewsDraft(message: string) {
  const normalized = message.toLowerCase();
  const containsNewsMarker = isNewsCreateRequest(message);
  const containsLabeledNewsField =
    extractLabeledValue(message, titleLabels, [...titleLabels, ...bodyLabels]) !== null ||
    extractLabeledValue(message, bodyLabels, [...titleLabels, ...bodyLabels]) !== null;

  if (containsNewsMarker || containsLabeledNewsField) {
    return false;
  }

  return switchMarkers.some((marker) => normalized.includes(marker.toLowerCase()));
}

export function mergePendingNewsComposeState(input: {
  state: PendingNewsComposeState;
  message: string;
  selectedAsset?: ChatAssetOption | null;
}) {
  const { state, message } = input;
  const selectedAsset = input.selectedAsset ?? null;
  const allLabels = [...titleLabels, ...bodyLabels];

  const labeledTitle = extractLabeledValue(message, titleLabels, allLabels);
  const labeledBody = extractLabeledValue(message, bodyLabels, allLabels);
  const plainMessage = message.trim();
  const next: PendingNewsComposeState = {
    ...state,
    title: labeledTitle ?? state.title,
    body: labeledBody ?? state.body,
    imageRequested: state.imageRequested || hasImageSignal(message) || Boolean(selectedAsset),
    imageAssetId: selectedAsset?.id ?? state.imageAssetId,
    imageUrl: selectedAsset?.publicUrl ?? state.imageUrl,
    imageAltText: selectedAsset?.altText ?? state.imageAltText,
    missingFields: []
  };

  if (!labeledTitle && !labeledBody && !selectedAsset && state.missingFields.length === 1) {
    const onlyMissing = state.missingFields[0];

    if (onlyMissing === "title" && plainMessage !== "") {
      next.title = plainMessage;
    }

    if (onlyMissing === "body" && plainMessage !== "") {
      next.body = plainMessage;
    }
  }

  next.missingFields = buildMissingFields({
    title: next.title,
    body: next.body,
    imageRequested: next.imageRequested,
    imageAssetId: next.imageAssetId
  });

  return next;
}

export function buildPendingNewsFollowupQuestion(state: PendingNewsComposeState) {
  const labels = state.missingFields.map((field) => {
    switch (field) {
      case "title":
        return "タイトル";
      case "body":
        return "本文";
      case "image":
        return "画像";
      default:
        return field;
    }
  });

  return `お知らせ作成に必要な ${labels.join("・")} を教えてください。例: タイトル: GW休業のお知らせ\n本文: 5月3日から5月6日まで休業します。`;
}
