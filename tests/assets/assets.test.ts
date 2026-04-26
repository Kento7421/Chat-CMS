import { describe, expect, it } from "vitest";
import { buildAssetStoragePath, sanitizeFilename } from "@/lib/assets/service";

describe("asset upload helpers", () => {
  it("builds storage paths within the site namespace", () => {
    const siteId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const assetId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    expect(buildAssetStoragePath(siteId, assetId, "hero image.png")).toBe(
      `${siteId}/${assetId}/hero-image.png`
    );
  });

  it("sanitizes filenames safely", () => {
    expect(sanitizeFilename(" company hero!!.jpg ")).toBe("company-hero.jpg");
    expect(sanitizeFilename("????")).toBe("image");
  });
});
