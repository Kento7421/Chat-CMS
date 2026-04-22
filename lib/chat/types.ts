import type { Database, Json } from "@/types/database";
import type { ChangeIntentCategory, SitePageKey, SiteSnapshot } from "@/types/domain";

export type ChatSessionRow = Database["public"]["Tables"]["chat_sessions"]["Row"];
export type ChatMessageRow = Database["public"]["Tables"]["chat_messages"]["Row"];
export type SuggestionSetRow = Database["public"]["Tables"]["suggestion_sets"]["Row"];
export type ChangeSetRow = Database["public"]["Tables"]["change_sets"]["Row"];

export type ChatFlowAction = "suggest_options" | "ask_followup" | "reject_request";
export type SupportedTargetField = "heading" | "body" | "phone" | "email" | "businessHours";

export interface ChatTargetReference {
  fieldId?: string | null;
  fieldLabel?: string | null;
  page: SitePageKey | null;
  section: string | null;
  field: SupportedTargetField | null;
}

export interface EditableChatTarget extends ChatTargetReference {
  fieldId: string;
  fieldLabel: string;
  page: SitePageKey;
  pageLabel: string;
  section: string;
  sectionLabel: string;
  field: SupportedTargetField;
  label: string;
  aliases: string[];
  currentValue: string;
  path: string[];
}

export interface SuggestionOption {
  key: string;
  title: string;
  summary: string;
  proposedValue: string;
  reasoning: string;
  target: ChatTargetReference;
}

export interface SuggestionSetPayload {
  suggestions: SuggestionOption[];
}

export interface AiInterpretationIntent {
  action_type: "text_update" | "clarify_request" | "reject_request";
  intent_category: ChangeIntentCategory;
  confidence: number;
  target_page: SitePageKey | null;
  target_section: string | null;
  target_field: SupportedTargetField | null;
  needs_confirmation: boolean;
  needs_more_input: boolean;
  user_message: string;
  assistant_message: string;
}

export interface AiInterpretationResult {
  flowAction: ChatFlowAction;
  intent: AiInterpretationIntent;
  followupQuestion: string | null;
  rejectionReason: string | null;
  suggestions: SuggestionOption[];
}

export interface ChatMessageView {
  id: string;
  role: ChatMessageRow["role"];
  content: string;
  metadata: Json | null;
  createdAt: string;
}

export interface SuggestionSetView {
  id: string;
  status: SuggestionSetRow["status"];
  selectedSuggestionKey: string | null;
  suggestions: SuggestionOption[];
  createdAt: string;
}

export interface ChangePreviewItem {
  id: string;
  summary: string;
  beforeValue: Json | null;
  afterValue: Json | null;
}

export interface PendingChangeSetView {
  id: string;
  status: ChangeSetRow["status"];
  summary: string | null;
  basedOnVersionId: string | null;
  previewDiff: ChangePreviewItem[];
  proposedSnapshotJson: SiteSnapshot;
}

export interface ChatWorkspaceState {
  session: {
    id: string;
    status: ChatSessionRow["status"];
    title: string | null;
  } | null;
  messages: ChatMessageView[];
  activeSuggestionSet: SuggestionSetView | null;
  pendingChangeSet: PendingChangeSetView | null;
}
