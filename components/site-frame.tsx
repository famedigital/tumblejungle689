import Link from "next/link";
import { PlaytabCredit, PlaytabMark } from "@/components/playtab-mark";
import { getSettings } from "@/lib/domain";

const NAV = [
  { href: "/play", label: "Play", short: "Play", wash: "bg-[#f3e2b0] hover:bg-[#e8d08a]" },
  { href: "/eat", label: "Cafe and restaurant", short: "Eat", wash: "bg-[#f6d2cb] hover:bg-[#f0bfb6]" },
  { href: "/visit", label: "Your visit", short: "Visit", wash: "bg-[#d5efe8] hover:bg-[#c3e6dd]" },
];

export async function SiteHeader() {
  const settings = await getSettings();
  return (
    <header className="sticky top-0 z-30 border-b border-[#146047]/15 bg-[#f7f4ee]/95 backdrop-blur-md">
      <div className="h-1 bg-[#146047]" />
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex min-w-0 items-center gap-2 font-heading text-xl text-[#146047] sm:text-2xl">
            <PlaytabMark size={40} />
            <span className="truncate">{settings.venueName}</span>
          </Link>
          <Link
            href="/login"
            className="ml-auto inline-flex h-11 shrink-0 items-center rounded-full bg-[#146047] px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2a008]"
          >
            Staff
          </Link>
        </div>
        <nav className="mt-3 grid grid-cols-3 gap-2" aria-label="Pages">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex h-11 items-center justify-center rounded-full px-2 text-center text-sm font-medium text-[#1c2420] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#146047] ${item.wash}`}
            >
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const settings = await getSettings();
  return (
    <footer className="mt-auto border-t border-[#e2a008]/40 bg-[#146047] text-[#f4fff8]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="font-heading text-2xl text-[#e2a008]">{settings.venueName}</p>
          <p>{settings.address}</p>
          {settings.hours ? <p>Hours {settings.hours}</p> : null}
          {settings.phone ? <p>{settings.phone}</p> : null}
        </div>
        <div className="space-y-3">
          <p className="max-w-sm text-[#d7f5ea]">Play photos on this site are freely licensed from Pexels.</p>
          <PlaytabCredit className="text-[#d7f5ea]" />
        </div>
      </div>
    </footer>
  );
}
