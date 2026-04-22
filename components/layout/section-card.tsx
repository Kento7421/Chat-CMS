import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  description: string;
  footer?: string;
  children?: React.ReactNode;
  className?: string;
};

export function SectionCard({
  title,
  description,
  footer,
  children,
  className
}: SectionCardProps) {
  return (
    <article
      className={cn(
        "rounded-[28px] border border-white/60 bg-white/75 p-6 shadow-panel backdrop-blur transition hover:-translate-y-0.5",
        className
      )}
    >
      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
        <p className="text-sm leading-7 text-slate-700">{description}</p>
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
      {footer ? <p className="mt-5 text-sm font-medium text-sea">{footer}</p> : null}
    </article>
  );
}
