// Brand mark: "cb" for career-buddy on the brand colour, in the UI face so it
// reads at every size from the favicon to the sidebar.
export function CoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand font-bold text-brand-foreground"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46), letterSpacing: "-0.04em", lineHeight: 1 }}
    >
      cb
    </span>
  );
}
