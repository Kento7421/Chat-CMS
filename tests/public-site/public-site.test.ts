import { describe, expect, it } from "vitest";
import { resolvePublicSiteCandidate } from "@/lib/public-site";
import { buildRenderablePages } from "@/lib/site-renderer";
import { normalizeSiteSnapshot } from "@/lib/site-snapshot";

describe("public site snapshot rendering", () => {
  it("creates a safe fallback snapshot when the current version is missing", () => {
    const snapshot = normalizeSiteSnapshot(null, {
      id: "site-1",
      name: "Demo Company",
      template_id: "template-1"
    });

    expect(snapshot.siteName).toBe("Demo Company");
    expect(snapshot.pages.map((page) => page.key)).toEqual(["home", "about", "contact", "news"]);
  });

  it("builds renderable pages from the normalized snapshot", () => {
    const snapshot = normalizeSiteSnapshot(null, {
      id: "site-1",
      name: "Demo Company",
      template_id: "template-1"
    });

    const pages = buildRenderablePages(snapshot);

    expect(pages).toHaveLength(4);
    expect(pages[0]?.sections[0]?.state.heading).toBe(snapshot.pages[0]?.sections[0]?.heading);
    expect(pages[2]?.sections[0]?.state.contactLines).toEqual([]);
  });
});

describe("public site resolution", () => {
  it("returns the published site when exactly one candidate exists", () => {
    const site = resolvePublicSiteCandidate([
      {
        id: "site-1",
        name: "Demo Company",
        slug: "demo-company",
        template_id: "template-1",
        current_version_id: "version-1",
        status: "published"
      }
    ]);

    expect(site?.id).toBe("site-1");
  });

  it("rejects duplicate published slug matches", () => {
    const site = resolvePublicSiteCandidate([
      {
        id: "site-1",
        name: "Client A",
        slug: "shared-slug",
        template_id: "template-1",
        current_version_id: "version-1",
        status: "published"
      },
      {
        id: "site-2",
        name: "Client B",
        slug: "shared-slug",
        template_id: "template-1",
        current_version_id: "version-2",
        status: "published"
      }
    ]);

    expect(site).toBeNull();
  });

  it("rejects non-published candidates", () => {
    const draftSite = resolvePublicSiteCandidate([
      {
        id: "site-1",
        name: "Draft Site",
        slug: "draft-site",
        template_id: "template-1",
        current_version_id: "version-1",
        status: "draft"
      }
    ]);

    const archivedSite = resolvePublicSiteCandidate([
      {
        id: "site-2",
        name: "Archived Site",
        slug: "archived-site",
        template_id: "template-1",
        current_version_id: "version-2",
        status: "archived"
      }
    ]);

    expect(draftSite).toBeNull();
    expect(archivedSite).toBeNull();
  });
});
