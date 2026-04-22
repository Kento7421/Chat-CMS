import { getServerEnv } from "@/lib/env";
import { aiInterpretationSchema, chatAiResponseJsonSchema } from "@/lib/chat/schemas";
import { interpretChatRequestHeuristically } from "@/lib/chat/heuristic";
import { buildChatMasterPrompt } from "@/lib/chat/prompt";
import { normalizeInterpretationTargets } from "@/lib/chat/targets";
import type { AiInterpretationResult, ChatMessageView, EditableChatTarget } from "@/lib/chat/types";
import type { SiteSnapshot } from "@/types/domain";

type GenerateChatInterpretationInput = {
  userMessage: string;
  snapshot: SiteSnapshot;
  editableTargets: EditableChatTarget[];
  recentMessages: ChatMessageView[];
};

type GenerateChatInterpretationResult = {
  interpretation: AiInterpretationResult;
  provider: "openai" | "heuristic";
  warning: string | null;
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

async function requestOpenAiInterpretation(
  input: GenerateChatInterpretationInput
): Promise<AiInterpretationResult | null> {
  const env = getServerEnv();

  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const systemPrompt = await buildChatMasterPrompt(input);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: input.userMessage
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: chatAiResponseJsonSchema
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        refusal?: string;
        content?: unknown;
      };
    }>;
  };
  const choice = payload.choices?.[0];
  const refusal = choice?.message?.refusal;

  if (refusal) {
    throw new Error(refusal);
  }

  const content = extractMessageContent(choice?.message?.content);

  if (!content) {
    throw new Error("OpenAI response did not include structured content.");
  }

  return aiInterpretationSchema.parse(JSON.parse(content));
}

function buildHeuristicInterpretation(input: GenerateChatInterpretationInput) {
  return interpretChatRequestHeuristically(input.userMessage, input.editableTargets);
}

export async function generateChatInterpretation(
  input: GenerateChatInterpretationInput
): Promise<GenerateChatInterpretationResult> {
  try {
    const interpretation = await requestOpenAiInterpretation(input);

    if (interpretation) {
      return {
        interpretation: normalizeInterpretationTargets(interpretation, input.editableTargets),
        provider: "openai",
        warning: null
      };
    }
  } catch (error) {
    return {
      interpretation: buildHeuristicInterpretation(input),
      provider: "heuristic",
      warning:
        error instanceof Error
          ? `AI解釈の呼び出しに失敗したため、ローカル推論で候補を生成しました: ${error.message}`
          : "AI解釈の呼び出しに失敗したため、ローカル推論で候補を生成しました。"
    };
  }

  return {
    interpretation: buildHeuristicInterpretation(input),
    provider: "heuristic",
    warning: "OPENAI_API_KEY が未設定のため、ローカル推論で候補を生成しました。"
  };
}
