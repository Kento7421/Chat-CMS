import type { Database, Json } from "@/types/database";
import type {
  AssetReference,
  ChangeIntentCategory,
  EditableFieldType,
  NewsSnapshotItem,
  SitePageKey,
  SiteSnapshot
} from "@/types/domain";

export type ChatSessionRow = Database["public"]["Tables"]["chat_sessions"]["Row"];
export type ChatMessageRow = Database["public"]["Tables"]["chat_messages"]["Row"];
export type SuggestionSetRow = Database["public"]["Tables"]["suggestion_sets"]["Row"];
export type ChangeSetRow = Database["public"]["Tables"]["change_sets"]["Row"];

export type ChatFlowAction = "suggest_options" | "ask_followup" | "reject_request";
export type SupportedTargetField =
  | "heading"
  | "body"
  | "phone"
  | "email"
  | "businessHours"
  | "imageAssetId";

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
  fieldType: EditableFieldType;
  label: string;
  aliases: string[];
  currentValue: string;
  currentAssetId: string | null;
  path: string[];
}

export interface ChatAssetOption {
  id: string;
  originalFilename: string;
  altText: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  publicUrl: string | null;
}

export interface SuggestedAssetPayload {
  id: string;
  label: string;
  url: string | null;
  altText: string | null;
}

export interface SuggestedNewsPostDraft {
  kind: "news_post";
  id?: string;
  title: string;
  body: string;
  imageAssetId?: string | null;
  imageUrl?: string | null;
  imageAltText?: string | null;
  publishedAt?: string;
}

export type PendingNewsComposeField = "title" | "body" | "image";

export interface PendingNewsComposeState {
  kind: "news_post_draft";
  title: string | null;
  body: string | null;
  imageRequested: boolean;
  imageAssetId: string | null;
  imageUrl: string | null;
  imageAltText: string | null;
  missingFields: PendingNewsComposeField[];
}

export interface SuggestionOption {
  key: string;
  title: string;
  summary: string;
  proposedValue: string;
  reasoning: string;
  target: ChatTargetReference;
  proposedAsset?: SuggestedAssetPayload | null;
  contentDraft?: SuggestedNewsPostDraft | null;
}

export interface SuggestionSetPayload {
  suggestions: SuggestionOption[];
}

export interface AiInterpretationIntent {
  action_type:
    | "text_update"
    | "asset_update"
    | "content_create"
    | "clarify_request"
    | "reject_request";
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

export interface SectionPreviewImageState {
  assetId: string | null;
  src: string | null;
  alt: string;
}

export interface SectionPreviewState {
  heading: string;
  body: string;
  contactLines: string[];
  image: SectionPreviewImageState | null;
  newsItems: NewsSnapshotItem[];
}

export interface PendingSectionPreview {
  sectionId: string;
  sectionLabel: string;
  changedFields: string[];
  before: SectionPreviewState;
  after: SectionPreviewState;
}

export interface PendingPagePreview {
  pageKey: SitePageKey;
  pageTitle: string;
  sections: PendingSectionPreview[];
}

export interface PendingChangePreview {
  pages: PendingPagePreview[];
}

export interface PendingChangeSetView {
  id: string;
  status: ChangeSetRow["status"];
  summary: string | null;
  basedOnVersionId: string | null;
  previewDiff: ChangePreviewItem[];
  preview: PendingChangePreview;
  proposedSnapshotJson: SiteSnapshot;
}

export interface ChatWorkspaceState {
  session: {
    id: string;
    status: ChatSessionRow["status"];
    title: string | null;
  } | null;
  messages: ChatMessageView[];
  pendingNewsDraft: PendingNewsComposeState | null;
  activeSuggestionSet: SuggestionSetView | null;
  pendingChangeSet: PendingChangeSetView | null;
}

export interface ApplySuggestionOptions {
  assetReference?: AssetReference | null;
}
