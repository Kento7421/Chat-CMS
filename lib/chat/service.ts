import {
  assertAppUserCanAccessSite,
  listAccessibleSitesForAppUser
} from "@/lib/auth/server";
import { getSiteAssetById, listSiteAssets, toPublicAssetOption } from "@/lib/assets/service";
import {
  aiInterpretationSchema,
  chatChangeSetPayloadSchema,
  pendingNewsComposeStateSchema,
  suggestionSetPayloadSchema
} from "@/lib/chat/schemas";
import { generateChatInterpretation } from "@/lib/chat/anthropic";
import {
  buildPendingNewsFollowupQuestion,
  createPendingNewsComposeStateFromMessage,
  isLikelyIntentSwitchFromNewsDraft,
  mergePendingNewsComposeState,
  toSuggestedNewsPostDraft
} from "@/lib/chat/news-draft";
import { buildPendingChangePreview } from "@/lib/chat/preview";
import { applySuggestionToSnapshot, buildEditableChatTargets } from "@/lib/chat/targets";
import { assetRowToSnapshotReference, normalizeSiteSnapshot } from "@/lib/site-snapshot";
import { buildNewsSnapshotItem } from "@/lib/news/service";
import { upsertNewsPostInSnapshot, upsertSnapshotAsset } from "@/lib/site-snapshot";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadTemplateEditableFieldDefinitions } from "@/lib/templates/editable-fields";
import {
  ChangeSetAlreadyAppliedError,
  SupabaseVersioningStore,
  VersionConflictError,
  createVersionDiff,
  publishChangeSet
} from "@/lib/versioning";
import type { AppUser, AccessibleSite } from "@/lib/auth/types";
import type {
  ChangePreviewItem,
  ChatAssetOption,
  ChatMessageRow,
  ChatMessageView,
  ChatWorkspaceState,
  PendingChangeSetView,
  SuggestionOption,
  SuggestionSetView
} from "@/lib/chat/types";
import type { SiteSnapshot } from "@/types/domain";
import type { Json } from "@/types/database";

type SiteDetails = AccessibleSite & {
  template_id: string;
};

type ResolveChatSessionInput = {
  siteId: string;
  appUser: AppUser;
  sessionId?: string;
  initialTitle?: string | null;
};

type InterpretChatInput = {
  siteId: string;
  sessionId?: string;
  assetId?: string;
  message: string;
};

type SelectSuggestionInput = {
  suggestionSetId: string;
  suggestionKey: string;
};

type ConfirmChangeSetInput = {
  changeSetId: string;
};

export class ChatFlowError extends Error {}

export class ChatOwnershipError extends ChatFlowError {}

export class ChatSelectionError extends ChatFlowError {}

function toMessageView(message: {
  id: string;
  role: ChatMessageRow["role"];
  content: string;
  metadata: Json | null;
  created_at: string;
}): ChatMessageView {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    metadata: message.metadata,
    createdAt: message.created_at
  };
}

function truncateTitle(message: string) {
  const normalized = message.trim().replace(/\s+/g, " ");
  return normalized.length > 40 ? `${normalized.slice(0, 40)}…` : normalized;
}

function buildPreviewDiff(diff: ReturnType<typeof createVersionDiff>): ChangePreviewItem[] {
  return diff.map((entry, index) => ({
    id: `${entry.pathLabel}-${index}`,
    summary: entry.summary,
    beforeValue: entry.beforeValue,
    afterValue: entry.afterValue
  }));
}

async function getSiteDetails(siteId: string, appUser: AppUser) {
  await assertAppUserCanAccessSite(appUser, siteId);
  const supabase = createSupabaseAdminClient();
  const { data: site, error } = await supabase
    .from("sites")
    .select("id,client_id,name,slug,current_version_id,template_id")
    .eq("id", siteId)
    .single();

  if (error) {
    throw new ChatFlowError(error.message);
  }

  return site as SiteDetails;
}

async function getCurrentSiteSnapshot(site: SiteDetails) {
  const supabase = createSupabaseAdminClient();

  if (!site.current_version_id) {
    return normalizeSiteSnapshot(null, site);
  }

  const { data: version, error } = await supabase
    .from("site_versions")
    .select("snapshot_json")
    .eq("id", site.current_version_id)
    .maybeSingle();

  if (error) {
    throw new ChatFlowError(error.message);
  }

  return normalizeSiteSnapshot(version?.snapshot_json ?? null, site);
}

async function getEditableTargetsForSite(site: SiteDetails, snapshot: SiteSnapshot) {
  const editableFieldDefinitions = await loadTemplateEditableFieldDefinitions(site.template_id);
  return buildEditableChatTargets(snapshot, editableFieldDefinitions);
}

async function getAvailableAssetsForSite(siteId: string) {
  try {
    return await listSiteAssets(siteId, 24);
  } catch (error) {
    throw new ChatFlowError(error instanceof Error ? error.message : "Failed to load site assets.");
  }
}

async function getSelectedAssetForSite(siteId: string, assetId?: string): Promise<ChatAssetOption | null> {
  if (!assetId) {
    return null;
  }

  try {
    const asset = await getSiteAssetById(siteId, assetId);

    if (!asset) {
      throw new ChatSelectionError("The selected asset could not be found for this site.");
    }

    return toPublicAssetOption(asset);
  } catch (error) {
    if (error instanceof ChatFlowError) {
      throw error;
    }

    throw new ChatFlowError(error instanceof Error ? error.message : "Failed to load the selected asset.");
  }
}

function inferIntentCategoryFromSuggestion(
  suggestion: SuggestionOption
) {
  if (suggestion.contentDraft?.kind === "news_post") {
    return "content_create" as const;
  }

  if (suggestion.target.field === "imageAssetId") {
    return "asset_update" as const;
  }

  if (
    suggestion.target.field === "phone" ||
    suggestion.target.field === "email" ||
    suggestion.target.field === "businessHours"
  ) {
    return "factual_update" as const;
  }

  return "expression_update" as const;
}

function isPlainObject(value: Json | null | undefined): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractPendingNewsComposeState(messages: ChatMessageView[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const metadata = messages[index]?.metadata;

    if (!isPlainObject(metadata) || !("pendingNewsDraft" in metadata)) {
      continue;
    }

    const value = metadata.pendingNewsDraft;

    if (value === null) {
      return null;
    }

    const parsed = pendingNewsComposeStateSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  return null;
}

function buildAssistantMetadata(input: {
  kind: string;
  suggestionSetId?: string | null;
  aiProvider?: string | null;
  warning?: string | null;
  pendingNewsDraft?: Json | null;
  changeSetId?: string | null;
}) {
  const metadata: Record<string, Json | undefined> = {
    kind: input.kind,
    suggestionSetId: input.suggestionSetId ?? undefined,
    aiProvider: input.aiProvider ?? undefined,
    warning: input.warning ?? undefined,
    changeSetId: input.changeSetId ?? undefined
  };

  if ("pendingNewsDraft" in input) {
    metadata.pendingNewsDraft = input.pendingNewsDraft ?? null;
  }

  return metadata;
}

function buildNewsSuggestionFromDraft(
  draft: NonNullable<ReturnType<typeof toSuggestedNewsPostDraft>>,
  editableTargets: Awaited<ReturnType<typeof getEditableTargetsForSite>>,
  availableAssets: ChatAssetOption[]
): SuggestionOption {
  const newsTarget =
    editableTargets.find((target) => target.page === "news" && target.section === "news-intro") ??
    editableTargets[0];
  const matchedAsset = draft.imageAssetId
    ? availableAssets.find((asset) => asset.id === draft.imageAssetId) ?? null
    : null;

  if (!newsTarget) {
    throw new ChatFlowError("No editable target is available for news previews.");
  }

  return {
    key: "option-1",
    title: "この内容でお知らせを作成",
    summary: "承認後にお知らせを公開します。",
    proposedValue: `${draft.title}\n${draft.body}`,
    reasoning: "不足情報が揃ったため、このまま承認前プレビューへ進めます。",
    target: {
      fieldId: newsTarget.fieldId,
      fieldLabel: newsTarget.fieldLabel,
      page: newsTarget.page,
      section: newsTarget.section,
      field: newsTarget.field
    },
    proposedAsset: matchedAsset
      ? {
          id: matchedAsset.id,
          label: matchedAsset.originalFilename,
          url: matchedAsset.publicUrl,
          altText: matchedAsset.altText
        }
      : null,
    contentDraft: draft
  };
}

async function buildProposedSnapshotForSuggestion(
  site: SiteDetails,
  baseSnapshot: SiteSnapshot,
  selectedSuggestion: SuggestionOption,
  editableTargets: Awaited<ReturnType<typeof getEditableTargetsForSite>>
) {
  if (selectedSuggestion.contentDraft?.kind !== "news_post") {
    const selectedAssetRow = selectedSuggestion.proposedAsset?.id
      ? await getSiteAssetById(site.id, selectedSuggestion.proposedAsset.id)
      : null;

    return applySuggestionToSnapshot(baseSnapshot, selectedSuggestion, editableTargets, {
      assetReference: selectedAssetRow ? assetRowToSnapshotReference(selectedAssetRow) : null
    });
  }

  let nextSnapshot = baseSnapshot;

  if (selectedSuggestion.contentDraft.imageAssetId) {
    const asset = await getSiteAssetById(site.id, selectedSuggestion.contentDraft.imageAssetId);

    if (!asset) {
      throw new ChatSelectionError("The selected image for the news post does not belong to this site.");
    }

    nextSnapshot = upsertSnapshotAsset(nextSnapshot, asset);
  }

  return upsertNewsPostInSnapshot(
    nextSnapshot,
    buildNewsSnapshotItem({
      id: selectedSuggestion.contentDraft.id ?? crypto.randomUUID(),
      title: selectedSuggestion.contentDraft.title,
      body: selectedSuggestion.contentDraft.body,
      publishedAt: selectedSuggestion.contentDraft.publishedAt ?? new Date().toISOString(),
      imageAssetId: selectedSuggestion.contentDraft.imageAssetId ?? null
    })
  );
}

async function touchChatSession(sessionId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("chat_sessions").update({}).eq("id", sessionId);

  if (error) {
    throw new ChatFlowError(error.message);
  }
}

async function appendChatMessage(input: {
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Json | null;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      session_id: input.sessionId,
      role: input.role,
      content: input.content,
      metadata: input.metadata ?? null
    })
    .select("*")
    .single();

  if (error) {
    throw new ChatFlowError(error.message);
  }

  await touchChatSession(input.sessionId);
  return data;
}

async function resolveChatSession(input: ResolveChatSessionInput) {
  const supabase = createSupabaseAdminClient();

  if (input.sessionId) {
    const { data: session, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", input.sessionId)
      .maybeSingle();

    if (error) {
      throw new ChatFlowError(error.message);
    }

    if (!session || session.site_id !== input.siteId || session.user_id !== input.appUser.id) {
      throw new ChatOwnershipError("指定されたチャットセッションにはアクセスできません。");
    }

    return session;
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("site_id", input.siteId)
    .eq("user_id", input.appUser.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (sessionsError) {
    throw new ChatFlowError(sessionsError.message);
  }

  const latestSession = sessions[0];

  if (latestSession) {
    return latestSession;
  }

  const { data: createdSession, error: createError } = await supabase
    .from("chat_sessions")
    .insert({
      client_id: input.appUser.clientId ?? "",
      site_id: input.siteId,
      user_id: input.appUser.id,
      title: input.initialTitle ?? null,
      status: "active"
    })
    .select("*")
    .single();

  if (createError) {
    throw new ChatFlowError(createError.message);
  }

  return createdSession;
}

async function findLatestChatSession(siteId: string, userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: sessions, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("site_id", siteId)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new ChatFlowError(error.message);
  }

  return sessions[0] ?? null;
}

async function loadSuggestionSetView(sessionId: string): Promise<SuggestionSetView | null> {
  const supabase = createSupabaseAdminClient();
  const { data: suggestionSets, error } = await supabase
    .from("suggestion_sets")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new ChatFlowError(error.message);
  }

  const record = suggestionSets.find((item) => item.status !== "dismissed") ?? null;

  if (!record) {
    return null;
  }

  const payload = suggestionSetPayloadSchema.parse({
    suggestions: record.suggestions_json
  });

  return {
    id: record.id,
    status: record.status,
    selectedSuggestionKey: record.selected_suggestion_key,
    suggestions: payload.suggestions,
    createdAt: record.created_at
  };
}

async function loadPendingChangeSetView(sessionId: string): Promise<PendingChangeSetView | null> {
  const supabase = createSupabaseAdminClient();
  const { data: changeSets, error } = await supabase
    .from("change_sets")
    .select("*")
    .eq("chat_session_id", sessionId)
    .in("status", ["awaiting_confirmation", "approved"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new ChatFlowError(error.message);
  }

  const record = changeSets[0];

  if (!record) {
    return null;
  }

  const payload = chatChangeSetPayloadSchema.parse(record.payload_json);
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id,name,template_id,current_version_id")
    .eq("id", record.site_id)
    .single();

  if (siteError) {
    throw new ChatFlowError(siteError.message);
  }

  let currentSnapshot = normalizeSiteSnapshot(null, site);

  if (site.current_version_id) {
    const { data: currentVersion, error: currentVersionError } = await supabase
      .from("site_versions")
      .select("snapshot_json")
      .eq("id", site.current_version_id)
      .maybeSingle();

    if (currentVersionError) {
      throw new ChatFlowError(currentVersionError.message);
    }

    currentSnapshot = normalizeSiteSnapshot(currentVersion?.snapshot_json ?? null, site);
  }

  const proposedSnapshot = payload.proposedSnapshotJson as unknown as SiteSnapshot;

  return {
    id: record.id,
    status: record.status,
    summary: record.summary,
    basedOnVersionId: payload.basedOnVersionId ?? null,
    previewDiff: payload.previewDiff ?? [],
    preview: buildPendingChangePreview(currentSnapshot, proposedSnapshot),
    proposedSnapshotJson: proposedSnapshot
  };
}

async function loadMessages(sessionId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ChatFlowError(error.message);
  }

  return messages.map(toMessageView);
}

async function loadChatWorkspaceStateForSession(sessionId: string): Promise<ChatWorkspaceState> {
  const supabase = createSupabaseAdminClient();
  const { data: session, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new ChatFlowError(error.message);
  }

  if (!session) {
    return {
      session: null,
      messages: [],
      pendingNewsDraft: null,
      activeSuggestionSet: null,
      pendingChangeSet: null
    };
  }

  const [messages, activeSuggestionSet, pendingChangeSet] = await Promise.all([
    loadMessages(session.id),
    loadSuggestionSetView(session.id),
    loadPendingChangeSetView(session.id)
  ]);
  const pendingNewsDraft =
    activeSuggestionSet || pendingChangeSet ? null : extractPendingNewsComposeState(messages);

  return {
    session: {
      id: session.id,
      status: session.status,
      title: session.title
    },
    messages,
    pendingNewsDraft,
    activeSuggestionSet,
    pendingChangeSet
  };
}

export async function getChatWorkspaceForAppUser(appUser: AppUser, siteId?: string) {
  const accessibleSites = await listAccessibleSitesForAppUser(appUser);
  const selectedSiteId = siteId ?? accessibleSites[0]?.id ?? null;

  if (!selectedSiteId) {
    return {
      accessibleSites,
      selectedSiteId: null,
      site: null,
      availableAssets: [],
      workspace: {
        session: null,
        messages: [],
        pendingNewsDraft: null,
        activeSuggestionSet: null,
        pendingChangeSet: null
      }
    };
  }

  const site = await getSiteDetails(selectedSiteId, appUser);
  const availableAssets = await getAvailableAssetsForSite(selectedSiteId);
  const session = await findLatestChatSession(selectedSiteId, appUser.id);
  const workspace = session
    ? await loadChatWorkspaceStateForSession(session.id)
    : {
        session: null,
        messages: [],
        pendingNewsDraft: null,
        activeSuggestionSet: null,
        pendingChangeSet: null
      };

  return {
    accessibleSites,
    selectedSiteId,
    site,
    availableAssets,
    workspace
  };
}

export async function interpretChatMessageForAppUser(appUser: AppUser, input: InterpretChatInput) {
  const site = await getSiteDetails(input.siteId, appUser);
  const session = await resolveChatSession({
    siteId: site.id,
    appUser,
    sessionId: input.sessionId,
    initialTitle: truncateTitle(input.message)
  });

  const previousMessages = await loadMessages(session.id);
  const pendingNewsDraft = extractPendingNewsComposeState(previousMessages);
  const selectedAsset = await getSelectedAssetForSite(site.id, input.assetId);
  const userMessage = await appendChatMessage({
    sessionId: session.id,
    role: "user",
    content: input.message,
    metadata: {
      kind: "user_request",
      assetId: selectedAsset?.id ?? null
    }
  });

  const snapshot = await getCurrentSiteSnapshot(site);
  const editableTargets = await getEditableTargetsForSite(site, snapshot);
  const availableAssets = await getAvailableAssetsForSite(site.id);
  const recentMessages = await loadMessages(session.id);
  let resolvedPendingNewsDraft = pendingNewsDraft;
  let aiResult:
    | Awaited<ReturnType<typeof generateChatInterpretation>>
    | {
        interpretation: ReturnType<typeof aiInterpretationSchema.parse>;
        provider: "heuristic";
        warning: string | null;
      };

  if (pendingNewsDraft && !isLikelyIntentSwitchFromNewsDraft(input.message)) {
    const mergedState = mergePendingNewsComposeState({
      state: pendingNewsDraft,
      message: input.message,
      selectedAsset
    });
    resolvedPendingNewsDraft = mergedState;
    const completedDraft = toSuggestedNewsPostDraft(mergedState);

    aiResult = completedDraft
      ? {
          interpretation: aiInterpretationSchema.parse({
            flowAction: "suggest_options",
            intent: {
              action_type: "content_create",
              intent_category: "content_create",
              confidence: 0.95,
              target_page: "news",
              target_section: "news-intro",
              target_field: "body",
              needs_confirmation: true,
              needs_more_input: false,
              user_message: input.message,
              assistant_message:
                "不足情報が揃いました。お知らせ作成の候補として承認前プレビューへ進めます。"
            },
            followupQuestion: null,
            rejectionReason: null,
            suggestions: [buildNewsSuggestionFromDraft(completedDraft, editableTargets, availableAssets)]
          }),
          provider: "heuristic" as const,
          warning: null
        }
      : {
          interpretation: aiInterpretationSchema.parse({
            flowAction: "ask_followup",
            intent: {
              action_type: "clarify_request",
              intent_category: "content_create",
              confidence: 0.9,
              target_page: "news",
              target_section: "news-intro",
              target_field: "body",
              needs_confirmation: false,
              needs_more_input: true,
              user_message: input.message,
              assistant_message: "お知らせ作成の不足情報を更新しました。"
            },
            followupQuestion: buildPendingNewsFollowupQuestion(mergedState),
            rejectionReason: null,
            suggestions: []
          }),
          provider: "heuristic" as const,
          warning: null
        };
  } else {
    aiResult = await generateChatInterpretation({
      userMessage: input.message,
      snapshot,
      editableTargets,
      recentMessages,
      selectedAsset,
      availableAssets
    });
  }

  const interpretation = aiResult.interpretation;
  let suggestionSetId: string | null = null;

  let nextPendingNewsDraft: Json | null | undefined = undefined;

  if (pendingNewsDraft && isLikelyIntentSwitchFromNewsDraft(input.message)) {
    nextPendingNewsDraft = null;
    aiResult.warning =
      aiResult.warning ??
      "お知らせ作成の途中状態はいったん解除して、今回の入力は別の操作として扱いました。";
  } else if (interpretation.intent.intent_category === "content_create") {
    if (interpretation.flowAction === "ask_followup") {
      const state =
        resolvedPendingNewsDraft ??
        createPendingNewsComposeStateFromMessage({
          message: input.message,
          selectedAsset
        });
      nextPendingNewsDraft = state as unknown as Json;
    } else {
      nextPendingNewsDraft = null;
    }
  }

  if (interpretation.flowAction === "suggest_options") {
    const supabase = createSupabaseAdminClient();
    const { data: suggestionSet, error } = await supabase
      .from("suggestion_sets")
      .insert({
        session_id: session.id,
        suggestions_json: interpretation.suggestions as unknown as Json,
        status: "pending"
      })
      .select("*")
      .single();

    if (error) {
      throw new ChatFlowError(error.message);
    }

    suggestionSetId = suggestionSet.id;
  }

  await appendChatMessage({
    sessionId: session.id,
    role: "assistant",
    content:
      interpretation.flowAction === "ask_followup"
        ? interpretation.followupQuestion ?? interpretation.intent.assistant_message
        : interpretation.rejectionReason ?? interpretation.intent.assistant_message,
    metadata: {
      ...buildAssistantMetadata({
        kind: interpretation.flowAction,
        suggestionSetId,
        aiProvider: aiResult.provider,
        warning: aiResult.warning,
        pendingNewsDraft: nextPendingNewsDraft
      })
    }
  });

  const workspace = await loadChatWorkspaceStateForSession(session.id);

  return {
    sessionId: session.id,
    userMessageId: userMessage.id,
    action: interpretation.flowAction,
    provider: aiResult.provider,
    warning: aiResult.warning,
    workspace
  };
}

export async function selectSuggestionForAppUser(appUser: AppUser, input: SelectSuggestionInput) {
  const supabase = createSupabaseAdminClient();
  const { data: suggestionSet, error } = await supabase
    .from("suggestion_sets")
    .select("*")
    .eq("id", input.suggestionSetId)
    .maybeSingle();

  if (error) {
    throw new ChatFlowError(error.message);
  }

  if (!suggestionSet) {
    throw new ChatSelectionError("候補セットが見つかりません。");
  }

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", suggestionSet.session_id)
    .single();

  if (sessionError) {
    throw new ChatFlowError(sessionError.message);
  }

  if (session.user_id !== appUser.id) {
    throw new ChatOwnershipError("この候補にはアクセスできません。");
  }

  const site = await getSiteDetails(session.site_id, appUser);
  const payload = suggestionSetPayloadSchema.parse({
    suggestions: suggestionSet.suggestions_json
  });
  const selectedSuggestion = payload.suggestions.find(
    (suggestion) => suggestion.key === input.suggestionKey
  );

  if (!selectedSuggestion) {
    throw new ChatSelectionError("選択した候補が見つかりません。");
  }

  if (suggestionSet.change_set_id) {
    const workspace = await loadChatWorkspaceStateForSession(session.id);

    return {
      sessionId: session.id,
      changeSetId: suggestionSet.change_set_id,
      workspace
    };
  }

  const store = new SupabaseVersioningStore(supabase);
  const currentVersion = await store.getCurrentSiteVersion(site.id);
  const baseSnapshot = await getCurrentSiteSnapshot(site);
  const editableTargets = await getEditableTargetsForSite(site, baseSnapshot);
  const proposedSnapshot = await buildProposedSnapshotForSuggestion(
    site,
    baseSnapshot,
    selectedSuggestion,
    editableTargets
  );
  const diff = createVersionDiff(
    baseSnapshot as unknown as Record<string, Json | undefined>,
    proposedSnapshot as unknown as Record<string, Json | undefined>
  ).filter((entry) => {
    const rootKey = entry.path[0];
    return rootKey !== "assets" && rootKey !== "assetIds";
  });
  const previewDiff = buildPreviewDiff(diff);
  const summary = `${selectedSuggestion.title}: ${selectedSuggestion.summary}`;

  await appendChatMessage({
    sessionId: session.id,
    role: "user",
    content: `候補「${selectedSuggestion.title}」を選択`,
    metadata: {
      kind: "select_suggestion",
      suggestionSetId: suggestionSet.id,
      suggestionKey: selectedSuggestion.key
    }
  });

  const { data: changeSet, error: changeSetError } = await supabase
    .from("change_sets")
    .insert({
      client_id: site.client_id,
      site_id: site.id,
      chat_session_id: session.id,
      requested_by_user_id: appUser.id,
      status: "awaiting_confirmation",
      intent_category: inferIntentCategoryFromSuggestion(selectedSuggestion),
      summary,
      payload_json: {
        basedOnVersionId: currentVersion?.id ?? null,
        proposedSnapshotJson: proposedSnapshot,
        selectedSuggestionKey: selectedSuggestion.key,
        suggestionSetId: suggestionSet.id,
        pendingNewsPost: selectedSuggestion.contentDraft ?? undefined,
        previewDiff
      } as unknown as Json
    })
    .select("*")
    .single();

  if (changeSetError) {
    throw new ChatFlowError(changeSetError.message);
  }

  const { error: suggestionUpdateError } = await supabase
    .from("suggestion_sets")
    .update({
      status: "selected",
      selected_suggestion_key: selectedSuggestion.key,
      change_set_id: changeSet.id
    })
    .eq("id", suggestionSet.id);

  if (suggestionUpdateError) {
    throw new ChatFlowError(suggestionUpdateError.message);
  }

  await appendChatMessage({
    sessionId: session.id,
    role: "assistant",
    content: "この内容で承認待ちにしました。差分を確認して、問題なければ公開してください。",
    metadata: {
      kind: "confirmation_request",
      suggestionSetId: suggestionSet.id,
      changeSetId: changeSet.id
    }
  });

  const workspace = await loadChatWorkspaceStateForSession(session.id);

  return {
    sessionId: session.id,
    changeSetId: changeSet.id,
    confirmationMessage: "承認待ちの変更を作成しました。",
    previewDiff,
    workspace
  };
}

export async function confirmChangeSetForAppUser(appUser: AppUser, input: ConfirmChangeSetInput) {
  const supabase = createSupabaseAdminClient();
  const { data: changeSet, error } = await supabase
    .from("change_sets")
    .select("*")
    .eq("id", input.changeSetId)
    .maybeSingle();

  if (error) {
    throw new ChatFlowError(error.message);
  }

  if (!changeSet) {
    throw new ChatFlowError("承認対象の変更が見つかりません。");
  }

  await getSiteDetails(changeSet.site_id, appUser);

  if (changeSet.status === "applied") {
    throw new ChangeSetAlreadyAppliedError("この変更はすでに公開済みです。");
  }

  if (changeSet.status !== "awaiting_confirmation") {
    throw new ChatSelectionError("この変更は承認待ちではありません。");
  }

  const now = new Date().toISOString();
  const approvedChangeSet = true;

  if (!approvedChangeSet) {
    throw new VersionConflictError(
      "ほかの操作によって承認状態が変わりました。画面を再読み込みしてください。"
    );
  }

  if (changeSet.chat_session_id) {
    await appendChatMessage({
      sessionId: changeSet.chat_session_id,
      role: "user",
      content: "この内容で公開する",
      metadata: {
        kind: "confirm_change_set",
        changeSetId: changeSet.id
      }
    });
  }

  const store = new SupabaseVersioningStore(supabase);
  const payload = chatChangeSetPayloadSchema.parse(changeSet.payload_json);
  const pendingNewsPost =
    payload.pendingNewsPost?.kind === "news_post" ? payload.pendingNewsPost : null;

  if (pendingNewsPost?.imageAssetId) {
    const asset = await getSiteAssetById(changeSet.site_id, pendingNewsPost.imageAssetId);

    if (!asset) {
      throw new ChatSelectionError("The image selected for the news post is not available for this site.");
    }
  }

  const result = await publishChangeSet(store, {
    changeSetId: changeSet.id,
    actorUserId: appUser.id,
    now: () => new Date().toISOString(),
    expectedChangeSetStatus: "awaiting_confirmation",
    changeSetPatch: {
      approved_by_user_id: appUser.id,
      approved_at: now
    },
    newsPost: pendingNewsPost
      ? {
          id: pendingNewsPost.id,
          client_id: changeSet.client_id,
          site_id: changeSet.site_id,
          title: pendingNewsPost.title,
          body: pendingNewsPost.body,
          image_asset_id: pendingNewsPost.imageAssetId ?? null,
          status: "published",
          published_at: pendingNewsPost.publishedAt ?? now,
          created_by_user_id: appUser.id
        }
      : null,
    auditLog: {
      client_id: changeSet.client_id,
      site_id: changeSet.site_id,
      actor_user_id: appUser.id,
      action: "publish",
      target_type: "site_version",
      target_id: null,
      metadata: {
        changeSetId: changeSet.id
      }
    }
  });

  if (changeSet.chat_session_id) {
    await appendChatMessage({
      sessionId: changeSet.chat_session_id,
      role: "assistant",
      content: `変更を公開しました。Version ${result.version.version_number} として履歴に保存しています。`,
      metadata: {
        kind: "publish_complete",
        changeSetId: changeSet.id,
        versionId: result.version.id
      }
    });
  }

  const workspace = changeSet.chat_session_id
    ? await loadChatWorkspaceStateForSession(changeSet.chat_session_id)
    : {
        session: null,
        messages: [],
        pendingNewsDraft: null,
        activeSuggestionSet: null,
        pendingChangeSet: null
      };

  return {
    version: result.version,
    diff: result.diff,
    message: `変更を公開しました。Version ${result.version.version_number} を作成しています。`,
    workspace
  };
}
