"use client";

import { useEffect, useState } from "react";
import { SiteBrowserPreview } from "@/components/site-renderer/site-browser-preview";
import type { SitePageKey, SiteSnapshot } from "@/types/domain";

type SiteCanvasProps = {
  siteSlug: string;
  currentSnapshot: SiteSnapshot;
  proposedSnapshot?: SiteSnapshot | null;
};

export function SiteCanvas({
  siteSlug,
  currentSnapshot,
  proposedSnapshot = null
}: SiteCanvasProps) {
  const [previewMode, setPreviewMode] = useState<"current" | "proposed">(
    proposedSnapshot ? "proposed" : "current"
  );
  const [activePageKey, setActivePageKey] = useState<SitePageKey>("home");

  useEffect(() => {
    if (!proposedSnapshot) {
      setPreviewMode("current");
    }
  }, [proposedSnapshot]);

  const activeSnapshot =
    previewMode === "proposed" && proposedSnapshot ? proposedSnapshot : currentSnapshot;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/60 bg-white/80 px-5 py-4 shadow-panel backdrop-blur">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sea">
            Live Site View
          </p>
          <h2 className="text-xl font-semibold text-ink">{activeSnapshot.siteName}</h2>
          <p className="text-sm text-slate-600">
            実際のサイトに近い見た目で、今の内容と反映後の内容を見比べられます。
          </p>
        </div>

        {proposedSnapshot ? (
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setPreviewMode("current")}
              className={[
                "rounded-full px-4 py-2 transition",
                previewMode === "current"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600"
              ].join(" ")}
            >
              現在のサイト
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("proposed")}
              className={[
                "rounded-full px-4 py-2 transition",
                previewMode === "proposed"
                  ? "bg-ink text-white shadow-sm"
                  : "text-slate-600"
              ].join(" ")}
            >
              反映後のイメージ
            </button>
          </div>
        ) : (
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            現在公開中
          </span>
        )}
      </div>

      <SiteBrowserPreview
        snapshot={activeSnapshot}
        addressLabel={`/sites/${siteSlug}`}
        pageKey={activePageKey}
        onPageKeyChange={setActivePageKey}
        compact
      />
    </section>
  );
}
