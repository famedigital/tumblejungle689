import Link from "next/link";
import { getSettings } from "@/lib/domain";

const NAV = [
  { href: "/play", label: "Play", wash: "bg-[#ffe8a3] hover:bg-[#ffd56a]" },
  { href: "/eat", label: "Cafe and restaurant", wash: "bg-[#ffc9c0] hover:bg-[#ffb0a3]" },
  { href: "/visit", label: "Your visit", wash: "bg-[#b7ebe3] hover:bg-[#8fddd2]" },
];

export function SiteHeader() {
  const settings = getSettings();
  return (
    <header className="sticky top-0 z-30 border-b border-[#ffb703]/50 bg-[#fffaf2]/90 backdrop-blur-md">
      <div className="h-1.5 bg-[linear-gradient(90deg,#ffb703_0%,#ff7a59_28%,#2ec4b6_62%,#7bdff2_82%,#ffb703_100%)]" />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="inline-flex items-center gap-2 font-heading text-2xl text-[#146047]">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#ffb703] text-sm text-[#3d2a00] shadow-sm ring-2 ring-white">
            TJ
          </span>
          {settings.venueName}
        </Link>
        <nav className="flex flex-wrap gap-2 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-1.5 font-medium text-[#1f4d3a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f7a5a] ${item.wash}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/login"
          className="ml-auto rounded-full bg-[#1f7a5a] px-3 py-1.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb703]"
        >
          Staff
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const settings = getSettings();
  return (
    <footer className="mt-auto border-t border-[#ffb703]/40 bg-[#146047] text-[#f4fff8]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 py-8 text-sm">
        <div className="space-y-1">
          <p className="font-heading text-2xl text-[#ffb703]">{settings.venueName}</p>
          <p>{settings.address}</p>
          {settings.hours ? <p>Hours {settings.hours}</p> : null}
          {settings.phone ? <p>{settings.phone}</p> : null}
        </div>
        <p className="max-w-sm text-[#d7f5ea]">Play photos on this site are freely licensed from Pexels.</p>
      </div>
    </footer>
  );
}
