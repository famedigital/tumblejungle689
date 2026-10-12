export function PhotoFrame({
  src,
  alt,
  label,
  className = "",
}: {
  src: string;
  alt: string;
  label?: string;
  className?: string;
}) {
  return (
    <figure className={`relative overflow-hidden bg-[#ffe8a3] ${className}`}>
      <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      {label ? (
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#123528]/85 via-[#123528]/35 to-transparent px-3 pt-10 pb-3 text-sm font-medium text-white">
          {label}
        </figcaption>
      ) : null}
    </figure>
  );
}
