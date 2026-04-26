import { describe, expect, it } from "vitest";
import { buildPendingChangePreview } from "@/lib/chat/preview";
import { interpretChatRequestHeuristically } from "@/lib/chat/heuristic";
import {
  applySuggestionToSnapshot,
  buildEditableChatTargets,
  normalizeInterpretationTargets
} from "@/lib/chat/targets";
import { buildRenderablePages } from "@/lib/site-renderer";
import { getFallbackEditableFieldDefinitions } from "@/lib/templates/editable-fields";
import type { SiteSnapshot } from "@/types/domain";

function createSnapshot(): SiteSnapshot {
  return {
    schemaVersion: "2026-04-22",
    templateVersion: "simple-corporate-v1",
    siteId: "site-1",
    templateId: "template-1",
    siteName: "Demo Company",
    navigation: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" }
    ],
    theme: {
      accentColor: "#0f766e",
      backgroundColor: "#f8f5ef",
      textColor: "#101828"
    },
    contact: {
      phone: "03-0000-0000",
      email: "hello@example.com",
      businessHours: "平日 9:00-18:00"
    },
    pages: [
      {
        key: "home",
        title: "トップページ",
        sections: [
          {
            id: "hero",
            heading: "地域に寄り添うサポート",
            body: "地域の事業者を丁寧に支援します。"
          }
        ]
      },
      {
        key: "about",
        title: "会社概要",
        sections: [
          {
            id: "company-overview",
            heading: "私たちについて",
            body: "会社紹介文です。"
          }
        ]
      },
      {
        key: "contact",
        title: "お問い合わせ",
        sections: [
          {
            id: "contact-info",
            heading: "お問い合わせ",
            body: "お気軽にご連絡ください。"
          }
        ]
      },
      {
        key: "news",
        title: "お知らせ",
        sections: [
          {
            id: "news-intro",
            heading: "お知らせ",
            body: "最新情報をご案内します。"
          }
        ]
      }
    ],
    news: [],
    assets: [],
    assetIds: []
  };
}

function createEditableTargets(snapshot = createSnapshot()) {
  return buildEditableChatTargets(
    snapshot,
    getFallbackEditableFieldDefinitions("simple-corporate", "simple-corporate-v1")
  );
}

describe("applySuggestionToSnapshot", () => {
  it("updates a page section field in the snapshot", () => {
    const snapshot = createSnapshot();
    const editableTargets = createEditableTargets(snapshot);

    const result = applySuggestionToSnapshot(
      snapshot,
      {
        key: "option-1",
        title: "親しみやすく更新",
        summary: "トップ見出しを変更します。",
        proposedValue: "はじめてでも安心して相談できます",
        reasoning: "やわらかい表現です。",
        target: {
          fieldId: "home.hero.heading",
          fieldLabel: "見出し",
          page: "home",
          section: "hero",
          field: "heading"
        }
      },
      editableTargets
    );

    expect(result.pages[0]?.sections[0]?.heading).toBe("はじめてでも安心して相談できます");
    expect(snapshot.pages[0]?.sections[0]?.heading).toBe("地域に寄り添うサポート");
  });

  it("rejects targets outside the editable field definitions", () => {
    const snapshot = createSnapshot();
    const editableTargets = createEditableTargets(snapshot).filter(
      (target) => target.fieldId !== "contact.contact-info.phone"
    );

    expect(() =>
      applySuggestionToSnapshot(
        snapshot,
        {
          key: "option-1",
          title: "電話番号更新",
          summary: "電話番号を変更します。",
          proposedValue: "03-1234-5678",
          reasoning: "明確な事実変更です。",
          target: {
            page: "contact",
            section: "contact-info",
            field: "phone"
          }
        },
        editableTargets
      )
    ).toThrow("editable field");
  });
});

describe("normalizeInterpretationTargets", () => {
  it("falls back to ask_followup when AI returns a target outside editable fields", () => {
    const result = normalizeInterpretationTargets(
      {
        flowAction: "suggest_options",
        intent: {
          action_type: "text_update",
          intent_category: "expression_update",
          confidence: 0.8,
          target_page: "services",
          target_section: "hero",
          target_field: "heading",
          needs_confirmation: true,
          needs_more_input: false,
          user_message: "サービスページの見出しを変えたい",
          assistant_message: "候補を作ります。"
        },
        followupQuestion: null,
        rejectionReason: null,
        suggestions: [
          {
            key: "option-1",
            title: "候補1",
            summary: "サービス見出し",
            proposedValue: "新しいサービス紹介",
            reasoning: "わかりやすい案です。",
            target: {
              page: "services",
              section: "hero",
              field: "heading"
            }
          }
        ]
      },
      createEditableTargets()
    );

    expect(result.flowAction).toBe("ask_followup");
    expect(result.suggestions).toHaveLength(0);
  });
});

describe("interpretChatRequestHeuristically", () => {
  it("returns factual update suggestions using editable field definitions", () => {
    const result = interpretChatRequestHeuristically(
      "お問い合わせページの電話番号を03-1234-5678に変更してください",
      createEditableTargets()
    );

    expect(result.flowAction).toBe("suggest_options");
    expect(result.intent.intent_category).toBe("factual_update");
    expect(result.suggestions[0]?.target.fieldId).toBe("contact.contact-info.phone");
    expect(result.suggestions[0]?.proposedValue).toBe("03-1234-5678");
  });

  it("asks a follow-up question when the target is ambiguous", () => {
    const result = interpretChatRequestHeuristically("内容を更新したいです", createEditableTargets());

    expect(result.flowAction).toBe("ask_followup");
    expect(result.followupQuestion).toBeTruthy();
  });
});

describe("buildPendingChangePreview", () => {
  it("builds section-based before/after preview for text updates", () => {
    const currentSnapshot = createSnapshot();
    const proposedSnapshot = applySuggestionToSnapshot(
      currentSnapshot,
      {
        key: "option-1",
        title: "トップ見出し更新",
        summary: "トップ見出しを変更します。",
        proposedValue: "もっと相談しやすい会社へ",
        reasoning: "親しみやすい見出しです。",
        target: {
          fieldId: "home.hero.heading",
          fieldLabel: "見出し",
          page: "home",
          section: "hero",
          field: "heading"
        }
      },
      createEditableTargets(currentSnapshot)
    );

    const preview = buildPendingChangePreview(currentSnapshot, proposedSnapshot);

    expect(preview.pages).toHaveLength(1);
    expect(preview.pages[0]?.pageKey).toBe("home");
    expect(preview.pages[0]?.sections[0]?.before.heading).toBe("地域に寄り添うサポート");
    expect(preview.pages[0]?.sections[0]?.after.heading).toBe("もっと相談しやすい会社へ");
  });

  it("keeps multi-field contact preview stable", () => {
    const currentSnapshot = createSnapshot();
    const proposedSnapshot: SiteSnapshot = {
      ...currentSnapshot,
      contact: {
        phone: "03-1234-5678",
        email: "support@example.com",
        businessHours: "平日 10:00-17:00"
      }
    };

    const preview = buildPendingChangePreview(currentSnapshot, proposedSnapshot);

    expect(preview.pages[0]?.pageKey).toBe("contact");
    expect(preview.pages[0]?.sections[0]?.changedFields).toContain("contact");
    expect(preview.pages[0]?.sections[0]?.after.contactLines).toContain("TEL 03-1234-5678");
    expect(preview.pages[0]?.sections[0]?.after.contactLines).toContain(
      "MAIL support@example.com"
    );
  });
});

describe("buildRenderablePages", () => {
  it("creates renderable sections that match public and preview needs", () => {
    const pages = buildRenderablePages(createSnapshot());

    expect(pages.map((page) => page.key)).toEqual(["home", "about", "contact", "news"]);
    expect(pages[2]?.sections[0]?.state.contactLines).toContain("TEL 03-0000-0000");
    expect(pages[0]?.sections[0]?.state.heading).toBe("地域に寄り添うサポート");
  });
});
