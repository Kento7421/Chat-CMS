import { describe, expect, it } from "vitest";
import { interpretChatRequestHeuristically } from "@/lib/chat/heuristic";
import { buildPendingChangePreview } from "@/lib/chat/preview";
import { applySuggestionToSnapshot, buildEditableChatTargets } from "@/lib/chat/targets";
import { buildRenderablePages } from "@/lib/site-renderer";
import { getFallbackEditableFieldDefinitions } from "@/lib/templates/editable-fields";
import type { ChatAssetOption } from "@/lib/chat";
import type { AssetReference, SiteSnapshot } from "@/types/domain";

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
      businessHours: "Weekdays 9:00-18:00"
    },
    pages: [
      {
        key: "home",
        title: "Home",
        sections: [
          {
            id: "hero",
            heading: "Welcome to Demo Company",
            body: "We help local businesses keep their sites fresh.",
            imageAssetId: "11111111-1111-4111-8111-111111111111",
            imageAlt: "Office exterior"
          }
        ]
      },
      {
        key: "about",
        title: "About",
        sections: [
          {
            id: "company-overview",
            heading: "About Us",
            body: "We support small businesses.",
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
            body: "Reach out anytime.",
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
            body: "Latest updates.",
            imageAssetId: null,
            imageAlt: null
          }
        ]
      }
    ],
    news: [],
    assets: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        kind: "image",
        storagePath: "site-1/11111111-1111-4111-8111-111111111111/office.jpg",
        altText: "Office exterior",
        mimeType: "image/jpeg",
        width: 1200,
        height: 720
      }
    ],
    assetIds: ["11111111-1111-4111-8111-111111111111"]
  };
}

function createAssetOption(): ChatAssetOption {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    originalFilename: "new-hero.jpg",
    altText: "New storefront",
    mimeType: "image/jpeg",
    width: 1400,
    height: 900,
    publicUrl: "https://example.com/new-hero.jpg"
  };
}

function createAssetReference(): AssetReference {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    kind: "image",
    storagePath: "site-1/22222222-2222-4222-8222-222222222222/new-hero.jpg",
    altText: "New storefront",
    mimeType: "image/jpeg",
    width: 1400,
    height: 900
  };
}

function createEditableTargets(snapshot = createSnapshot()) {
  return buildEditableChatTargets(
    snapshot,
    getFallbackEditableFieldDefinitions("simple-corporate", "simple-corporate-v1")
  );
}

describe("asset update heuristic", () => {
  it("creates an asset_update suggestion for image fields", () => {
    const selectedAsset = createAssetOption();
    const result = interpretChatRequestHeuristically(
      "トップ画像をこれに変更してください",
      createEditableTargets(),
      {
        selectedAsset,
        availableAssets: [selectedAsset]
      }
    );

    expect(result.flowAction).toBe("suggest_options");
    expect(result.intent.action_type).toBe("asset_update");
    expect(result.suggestions[0]?.target.fieldId).toBe("home.hero.imageAssetId");
    expect(result.suggestions[0]?.proposedAsset?.id).toBe(selectedAsset.id);
  });

  it("asks a follow-up when no asset is selected", () => {
    const result = interpretChatRequestHeuristically(
      "トップ画像を変えたい",
      createEditableTargets(),
      {
        availableAssets: []
      }
    );

    expect(result.flowAction).toBe("ask_followup");
    expect(result.followupQuestion).toContain("画像");
  });
});

describe("asset update snapshot application", () => {
  it("updates the snapshot image field and keeps asset metadata", () => {
    const snapshot = createSnapshot();
    const editableTargets = createEditableTargets(snapshot);
    const selectedAsset = createAssetOption();

    const nextSnapshot = applySuggestionToSnapshot(
      snapshot,
      {
        key: "option-1",
        title: "この画像に差し替える",
        summary: "トップ画像を差し替えます。",
        proposedValue: selectedAsset.originalFilename,
        reasoning: "選択された画像を使います。",
        target: {
          fieldId: "home.hero.imageAssetId",
          fieldLabel: "画像",
          page: "home",
          section: "hero",
          field: "imageAssetId"
        },
        proposedAsset: {
          id: selectedAsset.id,
          label: selectedAsset.originalFilename,
          url: selectedAsset.publicUrl,
          altText: selectedAsset.altText
        }
      },
      editableTargets,
      {
        assetReference: createAssetReference()
      }
    );

    expect(nextSnapshot.pages[0]?.sections[0]?.imageAssetId).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
    expect(
      nextSnapshot.assets.find((asset) => asset.id === "22222222-2222-4222-8222-222222222222")
        ?.storagePath
    ).toBe(
      "site-1/22222222-2222-4222-8222-222222222222/new-hero.jpg"
    );
  });

  it("builds preview and renderable pages with the updated image", () => {
    const currentSnapshot = createSnapshot();
    const editableTargets = createEditableTargets(currentSnapshot);
    const selectedAsset = createAssetOption();
    const proposedSnapshot = applySuggestionToSnapshot(
      currentSnapshot,
      {
        key: "option-1",
        title: "この画像に差し替える",
        summary: "トップ画像を差し替えます。",
        proposedValue: selectedAsset.originalFilename,
        reasoning: "選択された画像を使います。",
        target: {
          fieldId: "home.hero.imageAssetId",
          fieldLabel: "画像",
          page: "home",
          section: "hero",
          field: "imageAssetId"
        },
        proposedAsset: {
          id: selectedAsset.id,
          label: selectedAsset.originalFilename,
          url: selectedAsset.publicUrl,
          altText: selectedAsset.altText
        }
      },
      editableTargets,
      {
        assetReference: createAssetReference()
      }
    );

    const preview = buildPendingChangePreview(currentSnapshot, proposedSnapshot);
    const pages = buildRenderablePages(proposedSnapshot);

    expect(preview.pages[0]?.sections[0]?.changedFields).toContain("image");
    expect(preview.pages[0]?.sections[0]?.after.image?.assetId).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
    expect(pages[0]?.sections[0]?.state.image?.assetId).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
  });
});
