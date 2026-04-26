import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EditableFieldDefinition, EditableFieldType, SitePageKey } from "@/types/domain";
import type { SupportedTargetField } from "@/lib/chat/types";

const editableFieldTypeSchema = z.enum([
  "short_text",
  "rich_text",
  "image",
  "email",
  "phone",
  "business_hours"
]);

const editableFieldDefinitionSchema: z.ZodType<EditableFieldDefinition> = z.object({
  id: z.string().min(1),
  page: z.enum(["home", "about", "services", "contact", "news"]),
  section: z.string().min(1),
  field: z.string().min(1),
  label: z.string().min(1),
  type: editableFieldTypeSchema,
  description: z.string().min(1).optional(),
  pageLabel: z.string().min(1).optional(),
  sectionLabel: z.string().min(1).optional(),
  fieldLabel: z.string().min(1).optional(),
  aliases: z.array(z.string().min(1)).optional(),
  path: z.array(z.string().min(1)).optional()
});

const editableFieldDefinitionsSchema = z.array(editableFieldDefinitionSchema);

type SiteTemplateRecord = {
  id: string;
  code: string;
  template_version: string;
  editable_fields_json: unknown;
};

export interface SupportedEditableFieldDefinition extends EditableFieldDefinition {
  field: SupportedTargetField;
  pageLabel: string;
  sectionLabel: string;
  fieldLabel: string;
  aliases: string[];
  path: string[];
}

const supportedFieldMap: Record<string, SupportedTargetField> = {
  heading: "heading",
  body: "body",
  phone: "phone",
  email: "email",
  businessHours: "businessHours",
  business_hours: "businessHours",
  imageAssetId: "imageAssetId",
  image_asset_id: "imageAssetId"
};

function createFieldDefinition(input: {
  id: string;
  page: SitePageKey;
  pageLabel: string;
  section: string;
  sectionLabel: string;
  field: SupportedTargetField;
  fieldLabel: string;
  label: string;
  type: EditableFieldType;
  aliases?: string[];
  description?: string;
  path: string[];
}): SupportedEditableFieldDefinition {
  return {
    ...input,
    aliases: input.aliases ?? []
  };
}

export function getFallbackEditableFieldDefinitions(
  templateCode: string,
  templateVersion: string
): SupportedEditableFieldDefinition[] {
  const normalizedCode = `${templateCode}:${templateVersion}`.toLowerCase();

  if (!normalizedCode.includes("simple-corporate") && !normalizedCode.includes("corporate")) {
    return [];
  }

  return [
    createFieldDefinition({
      id: "home.hero.heading",
      page: "home",
      pageLabel: "トップページ",
      section: "hero",
      sectionLabel: "メインビジュアル",
      field: "heading",
      fieldLabel: "見出し",
      label: "トップページ / メインビジュアル / 見出し",
      type: "short_text",
      aliases: ["トップ", "ヒーロー", "キャッチコピー", "タイトル"],
      path: ["pages", "home", "sections", "hero", "heading"]
    }),
    createFieldDefinition({
      id: "home.hero.body",
      page: "home",
      pageLabel: "トップページ",
      section: "hero",
      sectionLabel: "メインビジュアル",
      field: "body",
      fieldLabel: "本文",
      label: "トップページ / メインビジュアル / 本文",
      type: "rich_text",
      aliases: ["トップ", "ヒーロー", "リード文", "説明文"],
      path: ["pages", "home", "sections", "hero", "body"]
    }),
    createFieldDefinition({
      id: "home.hero.imageAssetId",
      page: "home",
      pageLabel: "トップページ",
      section: "hero",
      sectionLabel: "メインビジュアル",
      field: "imageAssetId",
      fieldLabel: "画像",
      label: "トップページ / メインビジュアル / 画像",
      type: "image",
      aliases: ["トップ画像", "メイン画像", "メインビジュアル画像", "ヒーロー画像", "写真"],
      path: ["pages", "home", "sections", "hero", "imageAssetId"]
    }),
    createFieldDefinition({
      id: "about.company-overview.heading",
      page: "about",
      pageLabel: "会社概要",
      section: "company-overview",
      sectionLabel: "会社紹介",
      field: "heading",
      fieldLabel: "見出し",
      label: "会社概要 / 会社紹介 / 見出し",
      type: "short_text",
      aliases: ["会社概要見出し", "紹介見出し"],
      path: ["pages", "about", "sections", "company-overview", "heading"]
    }),
    createFieldDefinition({
      id: "about.company-overview.body",
      page: "about",
      pageLabel: "会社概要",
      section: "company-overview",
      sectionLabel: "会社紹介",
      field: "body",
      fieldLabel: "本文",
      label: "会社概要 / 会社紹介 / 本文",
      type: "rich_text",
      aliases: ["会社紹介文", "会社概要本文"],
      path: ["pages", "about", "sections", "company-overview", "body"]
    }),
    createFieldDefinition({
      id: "about.company-overview.imageAssetId",
      page: "about",
      pageLabel: "会社概要",
      section: "company-overview",
      sectionLabel: "会社紹介",
      field: "imageAssetId",
      fieldLabel: "画像",
      label: "会社概要 / 会社紹介 / 画像",
      type: "image",
      aliases: ["会社概要画像", "紹介画像", "about画像", "写真"],
      path: ["pages", "about", "sections", "company-overview", "imageAssetId"]
    }),
    createFieldDefinition({
      id: "contact.contact-info.body",
      page: "contact",
      pageLabel: "お問い合わせ",
      section: "contact-info",
      sectionLabel: "連絡先情報",
      field: "body",
      fieldLabel: "本文",
      label: "お問い合わせ / 連絡先情報 / 本文",
      type: "rich_text",
      aliases: ["お問い合わせ本文", "連絡先説明"],
      path: ["pages", "contact", "sections", "contact-info", "body"]
    }),
    createFieldDefinition({
      id: "contact.contact-info.phone",
      page: "contact",
      pageLabel: "お問い合わせ",
      section: "contact-info",
      sectionLabel: "連絡先情報",
      field: "phone",
      fieldLabel: "電話番号",
      label: "お問い合わせ / 電話番号",
      type: "phone",
      aliases: ["電話", "TEL", "連絡先"],
      path: ["contact", "phone"]
    }),
    createFieldDefinition({
      id: "contact.contact-info.email",
      page: "contact",
      pageLabel: "お問い合わせ",
      section: "contact-info",
      sectionLabel: "連絡先情報",
      field: "email",
      fieldLabel: "メールアドレス",
      label: "お問い合わせ / メールアドレス",
      type: "email",
      aliases: ["メール", "email", "e-mail"],
      path: ["contact", "email"]
    }),
    createFieldDefinition({
      id: "contact.contact-info.business-hours",
      page: "contact",
      pageLabel: "お問い合わせ",
      section: "contact-info",
      sectionLabel: "連絡先情報",
      field: "businessHours",
      fieldLabel: "営業時間",
      label: "お問い合わせ / 営業時間",
      type: "business_hours",
      aliases: ["営業時間", "営業日", "受付時間"],
      path: ["contact", "businessHours"]
    }),
    createFieldDefinition({
      id: "news.news-intro.heading",
      page: "news",
      pageLabel: "お知らせ",
      section: "news-intro",
      sectionLabel: "導入",
      field: "heading",
      fieldLabel: "見出し",
      label: "お知らせ / 導入 / 見出し",
      type: "short_text",
      aliases: ["ニュース見出し", "お知らせ見出し"],
      path: ["pages", "news", "sections", "news-intro", "heading"]
    }),
    createFieldDefinition({
      id: "news.news-intro.body",
      page: "news",
      pageLabel: "お知らせ",
      section: "news-intro",
      sectionLabel: "導入",
      field: "body",
      fieldLabel: "本文",
      label: "お知らせ / 導入 / 本文",
      type: "rich_text",
      aliases: ["ニュース本文", "お知らせ本文"],
      path: ["pages", "news", "sections", "news-intro", "body"]
    })
  ];
}

export function toSupportedEditableFieldDefinition(
  definition: EditableFieldDefinition
): SupportedEditableFieldDefinition | null {
  const supportedField = supportedFieldMap[definition.field];

  if (!supportedField) {
    return null;
  }

  return {
    ...definition,
    field: supportedField,
    pageLabel: definition.pageLabel ?? definition.page,
    sectionLabel: definition.sectionLabel ?? definition.section,
    fieldLabel: definition.fieldLabel ?? definition.label,
    aliases: definition.aliases ?? [],
    path:
      definition.path ??
      (supportedField === "phone" || supportedField === "email" || supportedField === "businessHours"
        ? ["contact", supportedField]
        : ["pages", definition.page, "sections", definition.section, supportedField])
  };
}

export function parseTemplateEditableFieldDefinitions(
  editableFieldsJson: unknown,
  fallbackDefinitions: SupportedEditableFieldDefinition[]
): SupportedEditableFieldDefinition[] {
  const parsed = editableFieldDefinitionsSchema.safeParse(editableFieldsJson);

  if (!parsed.success) {
    if (fallbackDefinitions.length > 0) {
      return fallbackDefinitions;
    }

    throw new Error("Template editable_fields_json is invalid.");
  }

  const supportedDefinitions = parsed.data
    .map(toSupportedEditableFieldDefinition)
    .filter((definition): definition is SupportedEditableFieldDefinition => definition !== null);

  return supportedDefinitions.length > 0 ? supportedDefinitions : fallbackDefinitions;
}

export async function loadTemplateEditableFieldDefinitions(templateId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: template, error } = await supabase
    .from("site_templates")
    .select("id,code,template_version,editable_fields_json")
    .eq("id", templateId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return buildTemplateEditableFieldCatalog(template as SiteTemplateRecord);
}

export function buildTemplateEditableFieldCatalog(template: SiteTemplateRecord) {
  const fallbackDefinitions = getFallbackEditableFieldDefinitions(
    template.code,
    template.template_version
  );

  return parseTemplateEditableFieldDefinitions(template.editable_fields_json, fallbackDefinitions);
}
