import { createSectionPreviewState } from "@/lib/site-section-state";
import type { SectionPreviewState } from "@/lib/chat/types";
import type { SitePageKey, SiteSnapshot } from "@/types/domain";

export interface RenderableSection {
  id: string;
  label: string;
  pageKey: SitePageKey;
  pageTitle: string;
  state: SectionPreviewState;
}

export interface RenderablePage {
  key: SitePageKey;
  title: string;
  sections: RenderableSection[];
}

function createRenderableSection(
  snapshot: SiteSnapshot,
  pageKey: SitePageKey,
  pageTitle: string,
  section: SiteSnapshot["pages"][number]["sections"][number]
): RenderableSection {
  return {
    id: section.id,
    label: section.heading,
    pageKey,
    pageTitle,
    state: createSectionPreviewState(snapshot, pageKey, section.id)
  };
}

export function buildRenderablePages(snapshot: SiteSnapshot): RenderablePage[] {
  return snapshot.pages.map((page) => ({
    key: page.key,
    title: page.title,
    sections: page.sections.map((section) =>
      createRenderableSection(snapshot, page.key, page.title, section)
    )
  }));
}
