export type UserRole = "client_owner" | "client_editor" | "operator_admin";

export type ChangeIntentCategory =
  | "expression_update"
  | "factual_update"
  | "asset_update"
  | "content_create"
  | "unsupported_request";

export type EditableFieldType =
  | "short_text"
  | "rich_text"
  | "image"
  | "email"
  | "phone"
  | "business_hours";

export type SitePageKey = "home" | "about" | "services" | "contact" | "news";

export interface EditableFieldDefinition {
  id: string;
  page: SitePageKey;
  section: string;
  field: string;
  label: string;
  type: EditableFieldType;
  description?: string;
  pageLabel?: string;
  sectionLabel?: string;
  fieldLabel?: string;
  aliases?: string[];
  path?: string[];
}

export interface SiteThemeConfig {
  accentColor: string;
  backgroundColor: string;
  textColor: string;
}

export interface AssetReference {
  id: string;
  kind: "image";
  storagePath: string;
  altText: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
}

export interface NewsSnapshotItem {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  imageAssetId?: string | null;
}

export interface ContactInfo {
  phone: string;
  email: string;
  businessHours: string;
}

export interface PublicSiteSnapshot {
  id: string;
  slug: string;
  name: string;
  templateName: string;
  hero: {
    title: string;
    copy: string;
  };
  contact: ContactInfo;
}

export interface SiteSnapshot {
  schemaVersion: string;
  templateVersion: string;
  siteId: string;
  templateId: string;
  siteName: string;
  navigation: Array<{
    label: string;
    href: string;
  }>;
  theme: SiteThemeConfig;
  contact: ContactInfo;
  pages: Array<{
    key: SitePageKey;
    title: string;
    sections: Array<{
      id: string;
      heading: string;
      body: string;
    }>;
  }>;
  news: NewsSnapshotItem[];
  assets: AssetReference[];
  assetIds: string[];
}

export interface AiIntentPayload {
  action_type: string;
  intent_category: ChangeIntentCategory;
  confidence: number;
  target_page: SitePageKey | null;
  target_section: string | null;
  target_field: string | null;
  needs_confirmation: boolean;
  needs_more_input: boolean;
  user_message: string;
  assistant_message: string;
}
