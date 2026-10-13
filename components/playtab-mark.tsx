const CREDIT = "Powered by PlayTab by GoKora, Innovates.bt";

export function PlaytabMark({
  size = 40,
  label = false,
  className = "",
}: {
  size?: number;
  label?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/playtab.png"
      alt={label ? "PlayTab" : ""}
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
    />
  );
}

export function PlaytabCredit({ className = "" }: { className?: string }) {
  return (
    <p className={`no-print flex items-center gap-2 text-xs leading-snug ${className}`}>
      <PlaytabMark size={22} />
      <span>{CREDIT}</span>
    </p>
  );
}
