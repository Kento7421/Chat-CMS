import Image from "next/image";
import type { SectionPreviewState } from "@/lib/chat/types";

type SectionRendererProps = {
  state: SectionPreviewState;
  compact?: boolean;
};

export function SectionRenderer({ state, compact = false }: SectionRendererProps) {
  return (
    <div
      className={[
        "space-y-4 bg-[linear-gradient(180deg,rgba(15,118,110,0.08),transparent)]",
        compact ? "px-4 py-4" : "px-5 py-5"
      ].join(" ")}
    >
      {state.image ? (
        <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white/90">
          {state.image.src ? (
            <Image
              src={state.image.src}
              alt={state.image.alt}
              width={1200}
              height={720}
              className="h-44 w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-44 items-center justify-center bg-slate-100 text-sm text-slate-500">
              Image selected
            </div>
          )}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="h-1.5 w-16 rounded-full bg-sea/25" />
        <h4
          className={
            compact ? "text-lg font-semibold tracking-tight text-ink" : "text-xl font-semibold tracking-tight text-ink"
          }
        >
          {state.heading || "No heading"}
        </h4>
        <p className="text-sm leading-7 text-slate-700">{state.body || "No body text"}</p>
      </div>

      {state.newsItems.length ? (
        <div className="space-y-3">
          {state.newsItems.map((item) => (
            <article
              key={item.id}
              className="rounded-[20px] border border-slate-200 bg-white/85 px-4 py-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {new Date(item.publishedAt).toLocaleDateString("ja-JP")}
              </p>
              <h5 className="mt-2 text-base font-semibold text-ink">{item.title}</h5>
              <p className="mt-2 text-sm leading-7 text-slate-700">{item.body}</p>
            </article>
          ))}
        </div>
      ) : null}

      {state.contactLines.length ? (
        <div className="rounded-[20px] border border-slate-200 bg-white/80 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Contact
          </p>
          <div className="mt-3 space-y-2 text-sm leading-7 text-slate-700">
            {state.contactLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
