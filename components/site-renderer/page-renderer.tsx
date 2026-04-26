import { SectionRenderer } from "@/components/site-renderer/section-renderer";
import type { RenderablePage } from "@/lib/site-renderer";

type PageRendererProps = {
  page: RenderablePage;
  compact?: boolean;
  embedded?: boolean;
};

export function PageRenderer({ page, compact = false, embedded = false }: PageRendererProps) {
  if (embedded) {
    return (
      <section className="space-y-5">
        {page.sections.map((section) => (
          <article
            key={section.id}
            className="overflow-hidden rounded-[28px] border border-white/70 bg-white/92 shadow-sm"
          >
            <SectionRenderer state={section.state} compact={compact} />
          </article>
        ))}
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sea">
            {page.key}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{page.title}</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {page.sections.length} section{page.sections.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {page.sections.map((section) => (
          <article key={section.id} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{section.label}</p>
            </div>
            <SectionRenderer state={section.state} compact={compact} />
          </article>
        ))}
      </div>
    </section>
  );
}
