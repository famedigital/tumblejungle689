import Link from "next/link";
import { PlaytabCredit, PlaytabMark } from "@/components/playtab-mark";
import { SiteNav } from "@/components/site-nav";
import { getSettings } from "@/lib/domain";

export async function SiteHeader() {
  const settings = await getSettings();
  const hours = settings.hours?.trim() || "10:00 AM - 8:00 PM";
  const place = settings.address?.trim() || "Changjiji, Thimphu";

  return (
    <header className="sticky top-0 z-40 isolate">
      {/* Status ribbon */}
      <div className="relative overflow-hidden bg-[#0f4a36] text-[#f4fff8]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 40%, #e2a008 0, transparent 42%), radial-gradient(circle at 88% 60%, #7dd3b0 0, transparent 40%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.14em] sm:text-[11px] sm:tracking-[0.16em]">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7dd3b0] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#9ae6c5]" />
          </span>
          <p className="truncate text-center">
            <span className="text-[#c8f5df]">Open today</span>
            <span className="mx-1.5 text-[#7dd3b0]/50">•</span>
            <span>{hours}</span>
            <span className="mx-1.5 hidden text-[#7dd3b0]/50 sm:inline">•</span>
            <span className="hidden sm:inline">{place}</span>
            <span className="mx-1.5 hidden text-[#7dd3b0]/50 md:inline">•</span>
            <span className="hidden md:inline text-[#e2a008]">Parents free</span>
          </p>
        </div>
      </div>

      {/* Brand + actions + nav */}
      <div className="border-b border-[#146047]/12 bg-[#f7f4ee]/92 backdrop-blur-xl supports-[backdrop-filter]:bg-[#f7f4ee]/80">
        <div className="mx-auto max-w-6xl px-4 pt-3.5 pb-3 sm:pt-4 sm:pb-3.5">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="group inline-flex min-w-0 items-center gap-2.5 sm:gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2a008]"
            >
              <span className="relative shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-[0.985]">
                <span className="absolute -inset-1 rounded-[1.15rem] bg-[#146047]/10 blur-sm opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                <PlaytabMark size={44} />
              </span>
              <span className="min-w-0">
                <span className="block font-heading text-[1.35rem] leading-none tracking-tight text-[#146047] sm:text-[1.65rem]">
                  {settings.venueName}
                </span>
                <span className="mt-1 hidden text-[11px] font-bold uppercase tracking-[0.18em] text-[#5c6b66] sm:block">
                  Indoor play · Cafe · Family
                </span>
              </span>
            </Link>

            {/* Desktop nav sits in the brand row on wide screens */}
            <div className="ml-2 hidden min-w-0 flex-1 justify-center lg:flex">
              <div className="w-full max-w-xl">
                <SiteNav />
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Link
                href="/visit"
                className="hidden h-11 items-center rounded-full border border-[#146047]/18 bg-white/70 px-4 text-sm font-extrabold text-[#146047] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#146047]/35 hover:bg-white active:scale-[0.985] sm:inline-flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2a008]"
              >
                Check pass
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-full bg-[#146047] px-4 sm:px-5 text-sm font-extrabold text-white shadow-[0_12px_28px_-14px_rgba(20,96,71,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#0f4a36] active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2a008]"
              >
                Staff
              </Link>
            </div>
          </div>

          {/* Mobile / tablet nav under brand */}
          <div className="mt-3 lg:hidden">
            <SiteNav />
          </div>
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const settings = await getSettings();
  return (
    <footer className="mt-auto relative overflow-hidden border-t border-[#e2a008]/25 bg-[#0f4a36] text-[#f4fff8]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 0%, #e2a008 0, transparent 45%), radial-gradient(circle at 10% 100%, #7dd3b0 0, transparent 40%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="font-heading text-3xl tracking-tight text-[#e2a008]">{settings.venueName}</p>
          <p className="text-[#d7f5ea]/90">{settings.address || "Changjiji, Thimphu"}</p>
          {settings.hours ? <p className="text-[#d7f5ea]/80">Hours {settings.hours}</p> : null}
          {settings.phone ? <p className="font-mono text-[#d7f5ea]/80">{settings.phone}</p> : null}
        </div>
        <div className="space-y-4 sm:max-w-sm sm:text-right">
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Link
              href="/play"
              className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-[#f4fff8] transition-colors hover:bg-white/10"
            >
              Play
            </Link>
            <Link
              href="/eat"
              className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-[#f4fff8] transition-colors hover:bg-white/10"
            >
              Eat
            </Link>
            <Link
              href="/visit"
              className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-[#f4fff8] transition-colors hover:bg-white/10"
            >
              Your visit
            </Link>
          </div>
          <p className="text-[#d7f5ea]/75">Play photos on this site are freely licensed from Pexels.</p>
          <PlaytabCredit className="text-[#d7f5ea]/75 sm:justify-end" />
        </div>
      </div>
    </footer>
  );
}
