import { describe, expect, it } from "vitest";
import { interpretChatRequestHeuristically } from "@/lib/chat/heuristic";
import {
  buildPendingNewsFollowupQuestion,
  createPendingNewsComposeState,
  isLikelyIntentSwitchFromNewsDraft,
  mergePendingNewsComposeState,
  toSuggestedNewsPostDraft
} from "@/lib/chat/news-draft";
import { buildPendingChangePreview } from "@/lib/chat/preview";
import { buildRenderablePages } from "@/lib/site-renderer";
import { upsertNewsPostInSnapshot } from "@/lib/site-snapshot";
import { buildEditableChatTargets } from "@/lib/chat/targets";
import { getFallbackEditableFieldDefinitions } from "@/lib/templates/editable-fields";
import type { ChatAssetOption } from "@/lib/chat";
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
      { label: "News", href: "/news" }
    ],
    theme: {
      accentColor: "#0f766e",
      backgroundColor: "#f8f5ef",
      textColor: "#101828"
    },
    contact: {
      phone: "",
      email: "",
      businessHours: ""
    },
    pages: [
      {
        key: "home",
        title: "Home",
        sections: [
          {
            id: "hero",
            heading: "Welcome",
            body: "Body",
            imageAssetId: null,
            imageAlt: null
          }
        ]
      },
      {
        key: "about",
        title: "About",
        sections: [
          {
            id: "company-overview",
            heading: "About",
            body: "Body",
            imageAssetId: null,
            imageAlt: null
          }
        ]
      },
      {
        key: "contact",
        title: "Contact",
        sections: [
          {
            id: "contact-info",
            heading: "Contact",
            body: "Body",
            imageAssetId: null,
            imageAlt: null
          }
        ]
      },
      {
        key: "news",
        title: "News",
        sections: [
          {
            id: "news-intro",
            heading: "News",
            body: "Latest updates",
            imageAssetId: null,
            imageAlt: null
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

function createAsset(): ChatAssetOption {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    originalFilename: "notice.jpg",
    altText: "Notice visual",
    mimeType: "image/jpeg",
    width: 1200,
    height: 720,
    publicUrl: "https://example.com/notice.jpg"
  };
}

describe("news create heuristic", () => {
  it("asks a follow-up when title or body is missing", () => {
    const result = interpretChatRequestHeuristically(
      "お知らせを作りたい",
      createEditableTargets(),
      { availableAssets: [] }
    );

    expect(result.flowAction).toBe("ask_followup");
    expect(result.followupQuestion).toContain("タイトル");
  });

  it("creates a content draft suggestion when title and body are provided", () => {
    const asset = createAsset();
    const result = interpretChatRequestHeuristically(
      "お知らせを作成\nタイトル: GW休業のお知らせ\n本文: 5月3日から5月6日まで休業します。\n画像付き",
      createEditableTargets(),
      { selectedAsset: asset, availableAssets: [asset] }
    );

    expect(result.flowAction).toBe("suggest_options");
    expect(result.intent.action_type).toBe("content_create");
    expect(result.suggestions[0]?.contentDraft?.kind).toBe("news_post");
    expect(result.suggestions[0]?.contentDraft?.title).toBe("GW休業のお知らせ");
    expect(result.suggestions[0]?.contentDraft?.imageAssetId).toBe(asset.id);
  });
});

describe("news draft follow-up state", () => {
  it("fills title, body, and image across multiple turns", () => {
    const state1 = createPendingNewsComposeState({
      title: "GW休業のお知らせ"
    });
    const state2 = mergePendingNewsComposeState({
      state: state1,
      message: "5月3日から5月6日まで休業します。"
    });
    const state3 = mergePendingNewsComposeState({
      state: {
        ...state2,
        imageRequested: true,
        missingFields: ["image"]
      },
      message: "画像はこれでお願いします",
      selectedAsset: createAsset()
    });

    expect(state1.missingFields).toEqual(["body"]);
    expect(state2.body).toBe("5月3日から5月6日まで休業します。");
    expect(state3.imageAssetId).toBe("33333333-3333-4333-8333-333333333333");
    expect(toSuggestedNewsPostDraft(state3)?.title).toBe("GW休業のお知らせ");
  });

  it("builds a follow-up question for missing fields", () => {
    const state = createPendingNewsComposeState({
      title: "GW休業のお知らせ",
      imageRequested: true
    });

    expect(buildPendingNewsFollowupQuestion(state)).toContain("本文");
    expect(buildPendingNewsFollowupQuestion(state)).toContain("画像");
  });

  it("detects an intent switch safely", () => {
    expect(isLikelyIntentSwitchFromNewsDraft("トップページの見出しを変えたい")).toBe(true);
    expect(isLikelyIntentSwitchFromNewsDraft("本文: 5月3日から5月6日まで休業します。")).toBe(
      false
    );
  });
});

describe("news preview rendering", () => {
  it("shows the new news item in pending preview and renderable pages", () => {
    const currentSnapshot = createSnapshot();
    const proposedSnapshot = upsertNewsPostInSnapshot(currentSnapshot, {
      id: "44444444-4444-4444-8444-444444444444",
      title: "GW休業のお知らせ",
      body: "5月3日から5月6日まで休業します。",
      publishedAt: "2026-04-22T00:00:00.000Z",
      imageAssetId: null
    });

    const preview = buildPendingChangePreview(currentSnapshot, proposedSnapshot);
    const pages = buildRenderablePages(proposedSnapshot);

    expect(preview.pages[0]?.pageKey).toBe("news");
    expect(preview.pages[0]?.sections[0]?.changedFields).toContain("news");
    expect(preview.pages[0]?.sections[0]?.after.newsItems[0]?.title).toBe("GW休業のお知らせ");
    expect(pages[3]?.sections[0]?.state.newsItems[0]?.title).toBe("GW休業のお知らせ");
  });
});
