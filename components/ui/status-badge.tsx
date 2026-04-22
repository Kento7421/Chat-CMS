type StatusBadgeProps = {
  children: React.ReactNode;
};

export function StatusBadge({ children }: StatusBadgeProps) {
  return (
    <span className="inline-flex w-fit rounded-full border border-sea/20 bg-sea/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sea">
      {children}
    </span>
  );
}
