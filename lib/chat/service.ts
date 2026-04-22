import {
  assertAppUserCanAccessSite,
  listAccessibleSitesForAppUser
} from "@/lib/auth/server";
import { chatChangeSetPayloadSchema, suggestionSetPayloadSchema } from "@/lib/chat/schemas";
import { generateChatInterpretation } from "@/lib/chat/openai";
import { applySuggestionToSnapshot, buildEditableChatTargets } from "@/lib/chat/targets";
import { normalizeSiteSnapshot } from "@/lib/site-snapshot";
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
  ChatMessageRow,
  ChatMessageView,
  ChatWorkspaceState,
  PendingChangeSetView,
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

  return {
    id: record.id,
    status: record.status,
    summary: record.summary,
    basedOnVersionId: payload.basedOnVersionId ?? null,
    previewDiff: payload.previewDiff ?? [],
    proposedSnapshotJson: payload.proposedSnapshotJson as unknown as SiteSnapshot
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
      activeSuggestionSet: null,
      pendingChangeSet: null
    };
  }

  const [messages, activeSuggestionSet, pendingChangeSet] = await Promise.all([
    loadMessages(session.id),
    loadSuggestionSetView(session.id),
    loadPendingChangeSetView(session.id)
  ]);

  return {
    session: {
      id: session.id,
      status: session.status,
      title: session.title
    },
    messages,
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
      workspace: {
        session: null,
        messages: [],
        activeSuggestionSet: null,
        pendingChangeSet: null
      }
    };
  }

  const site = await getSiteDetails(selectedSiteId, appUser);
  const session = await findLatestChatSession(selectedSiteId, appUser.id);
  const workspace = session
    ? await loadChatWorkspaceStateForSession(session.id)
    : {
        session: null,
        messages: [],
        activeSuggestionSet: null,
        pendingChangeSet: null
      };

  return {
    accessibleSites,
    selectedSiteId,
    site,
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

  const userMessage = await appendChatMessage({
    sessionId: session.id,
    role: "user",
    content: input.message,
    metadata: {
      kind: "user_request"
    }
  });

  const snapshot = await getCurrentSiteSnapshot(site);
  const editableTargets = await getEditableTargetsForSite(site, snapshot);
  const recentMessages = await loadMessages(session.id);
  const aiResult = await generateChatInterpretation({
    userMessage: input.message,
    snapshot,
    editableTargets,
    recentMessages
  });
  const interpretation = aiResult.interpretation;
  let suggestionSetId: string | null = null;

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
      kind: interpretation.flowAction,
      suggestionSetId,
      aiProvider: aiResult.provider,
      warning: aiResult.warning
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
  const proposedSnapshot = applySuggestionToSnapshot(baseSnapshot, selectedSuggestion, editableTargets);
  const diff = createVersionDiff(
    baseSnapshot as unknown as Record<string, Json | undefined>,
    proposedSnapshot as unknown as Record<string, Json | undefined>
  );
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
      intent_category: "expression_update",
      summary,
      payload_json: {
        basedOnVersionId: currentVersion?.id ?? null,
        proposedSnapshotJson: proposedSnapshot,
        selectedSuggestionKey: selectedSuggestion.key,
        suggestionSetId: suggestionSet.id,
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
  const { data: approvedChangeSet, error: approveError } = await supabase
    .from("change_sets")
    .update({
      status: "approved",
      approved_by_user_id: appUser.id,
      approved_at: now
    })
    .eq("id", changeSet.id)
    .eq("status", "awaiting_confirmation")
    .select("*")
    .maybeSingle();

  if (approveError) {
    throw new ChatFlowError(approveError.message);
  }

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
  const result = await publishChangeSet(store, {
    changeSetId: changeSet.id,
    actorUserId: appUser.id,
    now: () => new Date().toISOString()
  });

  const { error: auditError } = await supabase.from("audit_logs").insert({
    client_id: changeSet.client_id,
    site_id: changeSet.site_id,
    actor_user_id: appUser.id,
    action: "publish",
    target_type: "site_version",
    target_id: result.version.id,
    metadata: {
      changeSetId: changeSet.id,
      publishedVersionId: result.version.id
    }
  });

  if (auditError) {
    throw new ChatFlowError(auditError.message);
  }

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
