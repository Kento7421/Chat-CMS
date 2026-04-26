"use client";

import { useEffect, useMemo, useState } from "react";
import { PageRenderer } from "@/components/site-renderer/page-renderer";
import { buildRenderablePages } from "@/lib/site-renderer";
import type { SitePageKey, SiteSnapshot } from "@/types/domain";

type SiteBrowserPreviewProps = {
  snapshot: SiteSnapshot;
  addressLabel: string;
  compact?: boolean;
  pageKey?: SitePageKey;
  onPageKeyChange?: (pageKey: SitePageKey) => void;
};

const pageLabels: Record<SitePageKey, string> = {
  home: "トップ",
  about: "会社概要",
  services: "サービス",
  contact: "お問い合わせ",
  news: "お知らせ"
};

export function SiteBrowserPreview({
  snapshot,
  addressLabel,
  compact = false,
  pageKey,
  onPageKeyChange
}: SiteBrowserPreviewProps) {
  const pages = useMemo(() => buildRenderablePages(snapshot), [snapshot]);
  const [internalPageKey, setInternalPageKey] = useState<SitePageKey>(pages[0]?.key ?? "home");
  const activePageKey = pageKey ?? internalPageKey;
  const activePage = pages.find((entry) => entry.key === activePageKey) ?? pages[0] ?? null;

  useEffect(() => {
    if (!pages.some((entry) => entry.key === activePageKey) && pages[0]) {
      if (pageKey && onPageKeyChange) {
        onPageKeyChange(pages[0].key);
      } else {
        setInternalPageKey(pages[0].key);
      }
    }
  }, [activePageKey, onPageKeyChange, pageKey, pages]);

  function handlePageChange(nextPageKey: SitePageKey) {
    if (onPageKeyChange) {
      onPageKeyChange(nextPageKey);
      return;
    }

    setInternalPageKey(nextPageKey);
  }

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-panel">
      <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-300" />
            <span className="h-3 w-3 rounded-full bg-amber-300" />
            <span className="h-3 w-3 rounded-full bg-emerald-300" />
          </div>
          <div className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
            <span className="block truncate">{addressLabel}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {pages.map((page) => (
            <button
              key={page.key}
              type="button"
              onClick={() => handlePageChange(page.key)}
              className={[
                "rounded-full px-3 py-2 text-sm font-medium transition",
                page.key === activePage?.key
                  ? "bg-ink text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              ].join(" ")}
            >
              {pageLabels[page.key] ?? page.title}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[calc(100vh-14rem)] overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#eef6f5_100%)] p-4 sm:p-5">
        {activePage ? (
          <PageRenderer page={activePage} compact={compact} embedded />
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-8 text-sm text-slate-600">
            表示できるページがまだありません。
          </div>
        )}
      </div>
    </section>
  );
}
