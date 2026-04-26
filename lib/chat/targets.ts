import { upsertSnapshotAsset } from "@/lib/site-snapshot";
import type { SupportedEditableFieldDefinition } from "@/lib/templates/editable-fields";
import type {
  AiInterpretationResult,
  ApplySuggestionOptions,
  ChatTargetReference,
  EditableChatTarget,
  SuggestionOption
} from "@/lib/chat/types";
import type { SiteSnapshot } from "@/types/domain";

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function includesNormalized(message: string, keyword: string) {
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  return normalizeText(message).includes(normalizedKeyword);
}

function cloneSnapshot(snapshot: SiteSnapshot) {
  return structuredClone(snapshot) as SiteSnapshot;
}

function getValueAtPath(snapshot: SiteSnapshot, path: string[]) {
  if (path[0] === "pages" && path[2] === "sections" && path.length === 5) {
    const page = snapshot.pages.find((item) => item.key === path[1]);
    const section = page?.sections.find((item) => item.id === path[3]);
    const field = path[4] as "heading" | "body" | "imageAssetId" | "imageAlt";
    return section?.[field] ?? null;
  }

  let current: unknown = snapshot;

  for (const segment of path) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current ?? null;
}

function setValueAtPath(snapshot: SiteSnapshot, path: string[], value: string | null) {
  if (path[0] === "pages" && path[2] === "sections" && path.length === 5) {
    const page = snapshot.pages.find((item) => item.key === path[1]);
    const section = page?.sections.find((item) => item.id === path[3]);
    const field = path[4];

    if (
      !page ||
      !section ||
      (field !== "heading" && field !== "body" && field !== "imageAssetId" && field !== "imageAlt")
    ) {
      throw new Error("Target path does not exist in the snapshot.");
    }

    section[field] = value as never;
    return;
  }

  let current: unknown = snapshot;

  for (const segment of path.slice(0, -1)) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      throw new Error("Target path does not exist in the snapshot.");
    }

    current = (current as Record<string, unknown>)[segment];
  }

  const lastSegment = path[path.length - 1];

  if (!lastSegment || typeof current !== "object" || current === null) {
    throw new Error("Target path is invalid.");
  }

  (current as Record<string, unknown>)[lastSegment] = value;
}

function buildAliases(definition: SupportedEditableFieldDefinition) {
  return Array.from(
    new Set(
      [
        definition.label,
        definition.pageLabel,
        definition.sectionLabel,
        definition.fieldLabel,
        definition.page,
        definition.section,
        definition.field,
        ...(definition.aliases ?? []),
        definition.description ?? ""
      ]
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function formatCurrentValue(
  snapshot: SiteSnapshot,
  definition: SupportedEditableFieldDefinition,
  rawValue: unknown
) {
  if (definition.field === "imageAssetId") {
    if (typeof rawValue !== "string" || rawValue.length === 0) {
      return {
        currentValue: "",
        currentAssetId: null
      };
    }

    const asset = snapshot.assets.find((item) => item.id === rawValue);

    return {
      currentValue: asset?.altText ?? asset?.storagePath ?? rawValue,
      currentAssetId: rawValue
    };
  }

  return {
    currentValue: typeof rawValue === "string" ? rawValue : "",
    currentAssetId: null
  };
}

export function buildEditableChatTargets(
  snapshot: SiteSnapshot,
  definitions: SupportedEditableFieldDefinition[]
): EditableChatTarget[] {
  return definitions
    .map((definition) => {
      const rawValue = getValueAtPath(snapshot, definition.path);
      const { currentValue, currentAssetId } = formatCurrentValue(snapshot, definition, rawValue);

      if (rawValue == null && definition.field !== "imageAssetId") {
        return null;
      }

      return {
        fieldId: definition.id,
        fieldLabel: definition.fieldLabel,
        page: definition.page,
        pageLabel: definition.pageLabel,
        section: definition.section,
        sectionLabel: definition.sectionLabel,
        field: definition.field,
        fieldType: definition.type,
        label: definition.label,
        aliases: buildAliases(definition),
        currentValue,
        currentAssetId,
        path: definition.path
      } satisfies EditableChatTarget;
    })
    .filter((target): target is EditableChatTarget => target !== null);
}

export function resolveTargetLabel(target: Pick<EditableChatTarget, "fieldLabel" | "label">) {
  return target.fieldLabel || target.label;
}

export function resolveEditableChatTarget(
  editableTargets: EditableChatTarget[],
  target: ChatTargetReference
): EditableChatTarget | null {
  if (target.fieldId) {
    const exactByFieldId = editableTargets.find((item) => item.fieldId === target.fieldId);

    if (exactByFieldId) {
      return exactByFieldId;
    }
  }

  const exactMatch = editableTargets.find(
    (item) =>
      item.page === target.page &&
      item.section === target.section &&
      item.field === target.field
  );

  if (exactMatch) {
    return exactMatch;
  }

  if (target.fieldLabel) {
    const byFieldLabel = editableTargets.filter((item) =>
      includesNormalized(item.fieldLabel, target.fieldLabel ?? "")
    );

    if (byFieldLabel.length === 1) {
      return byFieldLabel[0] ?? null;
    }
  }

  return null;
}

function canonicalizeSuggestionTarget(
  suggestion: SuggestionOption,
  editableTargets: EditableChatTarget[]
): SuggestionOption | null {
  if (suggestion.contentDraft?.kind === "news_post") {
    return {
      ...suggestion,
      contentDraft: {
        ...suggestion.contentDraft,
        id: suggestion.contentDraft.id ?? crypto.randomUUID(),
        publishedAt: suggestion.contentDraft.publishedAt ?? new Date().toISOString()
      }
    };
  }

  const resolvedTarget = resolveEditableChatTarget(editableTargets, suggestion.target);

  if (!resolvedTarget) {
    return null;
  }

  return {
    ...suggestion,
    target: {
      fieldId: resolvedTarget.fieldId,
      fieldLabel: resolvedTarget.fieldLabel,
      page: resolvedTarget.page,
      section: resolvedTarget.section,
      field: resolvedTarget.field
    }
  };
}

export function normalizeInterpretationTargets(
  interpretation: AiInterpretationResult,
  editableTargets: EditableChatTarget[]
): AiInterpretationResult {
  if (interpretation.flowAction !== "suggest_options") {
    return interpretation;
  }

  const canonicalSuggestions = interpretation.suggestions
    .map((suggestion) => canonicalizeSuggestionTarget(suggestion, editableTargets))
    .filter((suggestion): suggestion is SuggestionOption => suggestion !== null)
    .filter((suggestion) => {
      if (suggestion.contentDraft?.kind === "news_post") {
        return Boolean(suggestion.contentDraft.title && suggestion.contentDraft.body);
      }

      if (suggestion.target.field !== "imageAssetId") {
        return true;
      }

      return Boolean(suggestion.proposedAsset?.id);
    });

  if (canonicalSuggestions.length === 0) {
    return {
      flowAction: "ask_followup",
      intent: {
        ...interpretation.intent,
        action_type: "clarify_request",
        needs_more_input: true,
        needs_confirmation: false
      },
      followupQuestion:
        "変更したい場所をもう少し具体的に教えてください。画像を変えたい場合は、どのページの画像かも合わせて指定してください。",
      rejectionReason: null,
      suggestions: []
    };
  }

  return {
    ...interpretation,
    suggestions: canonicalSuggestions
  };
}

function scoreTargetAgainstMessage(message: string, target: EditableChatTarget) {
  let score = 0;

  if (includesNormalized(message, target.pageLabel)) {
    score += 4;
  }

  if (includesNormalized(message, target.sectionLabel)) {
    score += 4;
  }

  if (includesNormalized(message, target.fieldLabel)) {
    score += 5;
  }

  if (includesNormalized(message, target.label)) {
    score += 6;
  }

  target.aliases.forEach((alias) => {
    if (includesNormalized(message, alias)) {
      score += 3;
    }
  });

  return score;
}

export function findLikelyEditableTargets(message: string, editableTargets: EditableChatTarget[]) {
  return editableTargets
    .map((target) => ({
      target,
      score: scoreTargetAgainstMessage(message, target)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
}

export function applySuggestionToSnapshot(
  snapshot: SiteSnapshot,
  suggestion: SuggestionOption,
  editableTargets: EditableChatTarget[],
  options?: ApplySuggestionOptions
): SiteSnapshot {
  const resolvedTarget = resolveEditableChatTarget(editableTargets, suggestion.target);

  if (!resolvedTarget) {
    throw new Error("The selected suggestion target is not an editable field.");
  }

  const nextSnapshot = cloneSnapshot(snapshot);

  if (resolvedTarget.field === "imageAssetId") {
    if (!suggestion.proposedAsset?.id) {
      throw new Error("The selected suggestion does not include a valid asset.");
    }

    if (!options?.assetReference) {
      throw new Error("Asset metadata is required to apply an image suggestion.");
    }

    setValueAtPath(nextSnapshot, resolvedTarget.path, suggestion.proposedAsset.id);
    const imageAltPath = [...resolvedTarget.path.slice(0, -1), "imageAlt"];
    setValueAtPath(
      nextSnapshot,
      imageAltPath,
      suggestion.proposedAsset.altText ?? options.assetReference.altText ?? null
    );

    return upsertSnapshotAsset(nextSnapshot, options.assetReference);
  }

  if (suggestion.contentDraft?.kind === "news_post") {
    throw new Error("News post suggestions must be handled outside applySuggestionToSnapshot.");
  }

  setValueAtPath(nextSnapshot, resolvedTarget.path, suggestion.proposedValue);
  return nextSnapshot;
}
