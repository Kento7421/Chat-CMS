export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      assets: TableDefinition<{
        id: string;
        client_id: string;
        site_id: string;
        kind: "image";
        storage_path: string;
        original_filename: string;
        mime_type: string;
        byte_size: number;
        width: number | null;
        height: number | null;
        alt_text: string | null;
        created_by_user_id: string | null;
        created_at: string;
        updated_at: string;
      }>;
      audit_logs: TableDefinition<{
        id: string;
        client_id: string | null;
        site_id: string | null;
        actor_user_id: string | null;
        action: string;
        target_type: string;
        target_id: string | null;
        metadata: Json;
        created_at: string;
      }>;
      change_sets: TableDefinition<{
        id: string;
        client_id: string;
        site_id: string;
        chat_session_id: string | null;
        status:
          | "draft"
          | "awaiting_confirmation"
          | "approved"
          | "applied"
          | "rejected"
          | "cancelled";
        requested_by_user_id: string;
        approved_by_user_id: string | null;
        intent_category: string | null;
        summary: string | null;
        payload_json: Json;
        created_at: string;
        updated_at: string;
        approved_at: string | null;
        applied_at: string | null;
        rejected_at: string | null;
      }>;
      chat_messages: TableDefinition<{
        id: string;
        session_id: string;
        role: "user" | "assistant" | "system";
        content: string;
        metadata: Json | null;
        created_at: string;
      }>;
      chat_sessions: TableDefinition<{
        id: string;
        client_id: string;
        site_id: string;
        user_id: string;
        title: string | null;
        status: "active" | "closed";
        created_at: string;
        updated_at: string;
        closed_at: string | null;
      }>;
      clients: TableDefinition<{
        id: string;
        name: string;
        slug: string;
        plan_name: string | null;
        status: "trial" | "active" | "paused" | "cancelled";
        created_at: string;
        updated_at: string;
      }>;
      news_posts: TableDefinition<{
        id: string;
        client_id: string;
        site_id: string;
        title: string;
        body: string;
        image_asset_id: string | null;
        status: "draft" | "published" | "archived";
        published_at: string | null;
        created_by_user_id: string | null;
        created_at: string;
        updated_at: string;
      }>;
      sites: TableDefinition<{
        id: string;
        client_id: string;
        template_id: string;
        slug: string;
        domain: string | null;
        name: string;
        status: "draft" | "published" | "archived";
        current_version_id: string | null;
        created_at: string;
        updated_at: string;
      }>;
      site_templates: TableDefinition<{
        id: string;
        name: string;
        code: string;
        description: string | null;
        template_version: string;
        editable_fields_json: Json;
        created_at: string;
        updated_at: string;
      }>;
      site_versions: TableDefinition<{
        id: string;
        client_id: string;
        site_id: string;
        version_number: number;
        parent_version_id: string | null;
        rollback_from_version_id: string | null;
        snapshot_json: Json;
        summary: string | null;
        created_by_user_id: string | null;
        source_change_set_id: string | null;
        created_at: string;
      }>;
      suggestion_sets: TableDefinition<{
        id: string;
        session_id: string;
        change_set_id: string | null;
        suggestions_json: Json;
        status: "pending" | "selected" | "dismissed";
        selected_suggestion_key: string | null;
        created_at: string;
        updated_at: string;
      }>;
      users: TableDefinition<{
        id: string;
        client_id: string | null;
        auth_user_id: string | null;
        role: "client_owner" | "client_editor" | "operator_admin";
        email: string;
        full_name: string | null;
        last_login_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      version_changes: TableDefinition<{
        id: string;
        site_version_id: string;
        page_key: string | null;
        section_key: string | null;
        field_key: string | null;
        change_type: string;
        before_value: Json | null;
        after_value: Json | null;
        summary: string | null;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
