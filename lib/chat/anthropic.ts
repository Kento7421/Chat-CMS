import { getServerEnv } from "@/lib/env";
import { aiInterpretationSchema, chatAiResponseJsonSchema } from "@/lib/chat/schemas";
import { interpretChatRequestHeuristically } from "@/lib/chat/heuristic";
import { buildChatMasterPrompt } from "@/lib/chat/prompt";
import { normalizeInterpretationTargets } from "@/lib/chat/targets";
import type {
  AiInterpretationResult,
  ChatAssetOption,
  ChatMessageView,
  EditableChatTarget
} from "@/lib/chat/types";
import type { SiteSnapshot } from "@/types/domain";

type GenerateChatInterpretationInput = {
  userMessage: string;
  snapshot: SiteSnapshot;
  editableTargets: EditableChatTarget[];
  recentMessages: ChatMessageView[];
  selectedAsset?: ChatAssetOption | null;
  availableAssets: ChatAssetOption[];
};

type GenerateChatInterpretationResult = {
  interpretation: AiInterpretationResult;
  provider: "anthropic" | "heuristic";
  warning: string | null;
};

type AnthropicContentBlock = {
  type?: string;
  text?: string;
};

function extractMessageContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (
          typeof item === "object" &&
          item !== null &&
          "type" in item &&
          "text" in item &&
          item.type === "text" &&
          typeof item.text === "string"
        ) {
          return item.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const startIndex = trimmed.indexOf("{");
  const endIndex = trimmed.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("Claude response did not include a JSON object.");
  }

  return trimmed.slice(startIndex, endIndex + 1);
}

function normalizeSuggestedAssets(
  interpretation: AiInterpretationResult,
  input: GenerateChatInterpretationInput
) {
  if (interpretation.flowAction !== "suggest_options") {
    return interpretation;
  }

  const assetIndex = new Map(input.availableAssets.map((asset) => [asset.id, asset]));

  const suggestions = interpretation.suggestions.map((suggestion) => {
    if (suggestion.contentDraft?.kind === "news_post") {
      const matchedAsset =
        (suggestion.contentDraft.imageAssetId
          ? assetIndex.get(suggestion.contentDraft.imageAssetId)
          : null) ??
        input.selectedAsset ??
        null;

      return {
        ...suggestion,
        proposedAsset: matchedAsset
          ? {
              id: matchedAsset.id,
              label: matchedAsset.originalFilename,
              url: matchedAsset.publicUrl,
              altText: matchedAsset.altText
            }
          : null,
        contentDraft: {
          ...suggestion.contentDraft,
          imageAssetId: matchedAsset?.id ?? null,
          imageUrl: matchedAsset?.publicUrl ?? null,
          imageAltText: matchedAsset?.altText ?? null
        }
      };
    }

    if (suggestion.target.field !== "imageAssetId") {
      return {
        ...suggestion,
        proposedAsset: null
      };
    }

    const matchedAsset =
      (suggestion.proposedAsset?.id ? assetIndex.get(suggestion.proposedAsset.id) : null) ??
      input.selectedAsset ??
      null;

    if (!matchedAsset) {
      return {
        ...suggestion,
        proposedAsset: null
      };
    }

    return {
      ...suggestion,
      proposedValue: matchedAsset.originalFilename,
      proposedAsset: {
        id: matchedAsset.id,
        label: matchedAsset.originalFilename,
        url: matchedAsset.publicUrl,
        altText: matchedAsset.altText
      }
    };
  });

  return {
    ...interpretation,
    suggestions
  };
}

async function requestAnthropicInterpretation(
  input: GenerateChatInterpretationInput
): Promise<AiInterpretationResult | null> {
  const env = getServerEnv();
  const apiKey = env.ANTHROPIC_API_KEY ?? env.CLAUDE_API_KEY;
  const model = env.ANTHROPIC_MODEL ?? env.CLAUDE_MODEL;

  if (!apiKey) {
    return null;
  }

  const systemPrompt = await buildChatMasterPrompt(input);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1600,
      system: [
        systemPrompt,
        "",
        "Return exactly one JSON object and nothing else.",
        "The JSON must match this schema exactly:",
        JSON.stringify(chatAiResponseJsonSchema.schema)
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: input.userMessage
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic API request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    content?: AnthropicContentBlock[];
  };
  const content = extractMessageContent(payload.content);

  if (!content) {
    throw new Error("Claude response did not include structured content.");
  }

  return aiInterpretationSchema.parse(JSON.parse(extractJsonObject(content)));
}

function buildHeuristicInterpretation(input: GenerateChatInterpretationInput) {
  return interpretChatRequestHeuristically(input.userMessage, input.editableTargets, {
    selectedAsset: input.selectedAsset ?? null,
    availableAssets: input.availableAssets
  });
}

export async function generateChatInterpretation(
  input: GenerateChatInterpretationInput
): Promise<GenerateChatInterpretationResult> {
  try {
    const interpretation = await requestAnthropicInterpretation(input);

    if (interpretation) {
      return {
        interpretation: normalizeInterpretationTargets(
          normalizeSuggestedAssets(interpretation, input),
          input.editableTargets
        ),
        provider: "anthropic",
        warning: null
      };
    }
  } catch (error) {
    return {
      interpretation: buildHeuristicInterpretation(input),
      provider: "heuristic",
      warning:
        error instanceof Error
          ? `AI interpretation failed, so the request was handled by the local heuristic: ${error.message}`
          : "AI interpretation failed, so the request was handled by the local heuristic."
    };
  }

  return {
    interpretation: buildHeuristicInterpretation(input),
    provider: "heuristic",
    warning: "ANTHROPIC_API_KEY is not configured, so the local heuristic was used."
  };
}
