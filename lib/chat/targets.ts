import type { AiInterpretationResult, ChatTargetReference, EditableChatTarget, SuggestionOption } from "@/lib/chat/types";
import type { SiteSnapshot } from "@/types/domain";
import type { SupportedEditableFieldDefinition } from "@/lib/templates/editable-fields";

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
    const value = section?.[path[4] as "heading" | "body"];
    return typeof value === "string" ? value : null;
  }

  let current: unknown = snapshot;

  for (const segment of path) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : null;
}

function setValueAtPath(snapshot: SiteSnapshot, path: string[], value: string) {
  if (path[0] === "pages" && path[2] === "sections" && path.length === 5) {
    const page = snapshot.pages.find((item) => item.key === path[1]);
    const section = page?.sections.find((item) => item.id === path[3]);
    const field = path[4];

    if (!page || !section || (field !== "heading" && field !== "body")) {
      throw new Error("更新対象のページまたはセクションが snapshot に存在しません。");
    }

    section[field] = value;
    return;
  }

  let current: unknown = snapshot;

  for (const segment of path.slice(0, -1)) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      throw new Error("更新対象のパスが snapshot に存在しません。");
    }

    current = (current as Record<string, unknown>)[segment];
  }

  const lastSegment = path[path.length - 1];

  if (!lastSegment || typeof current !== "object" || current === null) {
    throw new Error("更新対象のパスが不正です。");
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

export function buildEditableChatTargets(
  snapshot: SiteSnapshot,
  definitions: SupportedEditableFieldDefinition[]
): EditableChatTarget[] {
  return definitions
    .map((definition) => {
      const currentValue = getValueAtPath(snapshot, definition.path);

      if (currentValue == null) {
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
        label: definition.label,
        aliases: buildAliases(definition),
        currentValue,
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
    .filter((suggestion): suggestion is SuggestionOption => suggestion !== null);

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
        "更新先を一意に特定できませんでした。ページ名と、見出しか本文かをもう少し具体的に教えてください。",
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
  editableTargets: EditableChatTarget[]
): SiteSnapshot {
  const resolvedTarget = resolveEditableChatTarget(editableTargets, suggestion.target);

  if (!resolvedTarget) {
    throw new Error("選択した候補の target は editable field 定義に存在しません。");
  }

  const nextSnapshot = cloneSnapshot(snapshot);
  setValueAtPath(nextSnapshot, resolvedTarget.path, suggestion.proposedValue);
  return nextSnapshot;
}
