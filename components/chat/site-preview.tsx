"use client";

import { SectionRenderer } from "@/components/site-renderer/section-renderer";
import type { PendingChangePreview } from "@/lib/chat";

type SitePreviewProps = {
  preview: PendingChangePreview;
};

export function SitePreview({ preview }: SitePreviewProps) {
  if (!preview.pages.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm leading-7 text-slate-600">
        No visual preview is available for this change yet.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {preview.pages.map((page) => (
        <section
          key={page.pageKey}
          className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sea">
                Page Preview
              </p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{page.pageTitle}</h3>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
              {page.sections.length} section{page.sections.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-4 space-y-5">
            {page.sections.map((section) => (
              <article key={section.sectionId} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{section.sectionLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {section.changedFields.map((field) => (
                      <span
                        key={field}
                        className="rounded-full bg-sea/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sea"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <PreviewFrame label="Before" muted>
                    <SectionRenderer state={section.before} compact />
                  </PreviewFrame>
                  <PreviewFrame label="After">
                    <SectionRenderer state={section.after} compact />
                  </PreviewFrame>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PreviewFrame({
  label,
  muted = false,
  children
}: {
  label: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm",
        muted ? "opacity-80" : ""
      ].join(" ")}
    >
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </span>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-200" />
        </div>
      </div>
      {children}
    </div>
  );
}
