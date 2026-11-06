import Link from "next/link";
import { getSettings, listMenu } from "@/lib/domain";
import { PublicPassTracker } from "@/components/v2/PublicPassTracker";
import { PublicMenuShowcase } from "@/components/v2/PublicMenuShowcase";
import {
  Sparkles,
  Clock,
  ShieldCheck,
  Footprints,
  Phone,
  MapPin,
  MessageCircle,
  ArrowRight,
  Heart,
  Smartphone,
  CheckCircle2,
} from "lucide-react";

export default async function HomePage() {
  const [settings, menu] = await Promise.all([
    getSettings(),
    listMenu(),
  ]);

  const rates = settings.rates?.length
    ? settings.rates
    : [
        { minutes: 30, amountNu: 200 },
        { minutes: 60, amountNu: 350 },
        { minutes: 90, amountNu: 480 },
        { minutes: 120, amountNu: 600 },
      ];

  const whatsappPhone = settings.ownerPhone || settings.phone || "17123456";
  const whatsappUrl = `https://wa.me/975${whatsappPhone.replace(/\D/g, "").slice(-8)}?text=${encodeURIComponent(
    `Hello ${settings.venueName}! I would like to inquire about play passes and birthday bookings.`
  )}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Banner & Status */}
      <div className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white text-xs font-bold py-2.5 px-4 text-center tracking-wide flex items-center justify-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
        <span>OPEN TODAY • 10:00 AM - 8:00 PM • CHANGJIJI, THIMPHU</span>
        <span className="hidden md:inline">• Accompanying Parents Free</span>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 px-4 md:px-8">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 dark:bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-6 relative">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold uppercase tracking-widest">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            <span>Thimphu&apos;s Premier Family Play Haven</span>
          </div>

          <h1 className="font-extrabold text-4xl sm:text-6xl md:text-7xl tracking-tight text-slate-900 dark:text-white text-balance leading-[1.05]">
            Where Joy, Play & Family <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400">
              Meet in Thimphu
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-slate-300 text-balance leading-relaxed">
            {settings.tagline || "Climb, slide, snack, and stay a while."} Safe indoor soft-play arena, climbing structures, ball pit, and delicious family dining.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#passes"
              className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <span>Explore Play Passes</span>
              <ArrowRight className="h-4 w-4" />
            </a>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3.5 rounded-2xl border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm text-slate-800 dark:text-slate-200 transition-all flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4 text-emerald-500" />
              <span>WhatsApp Concierge</span>
            </a>

            <Link
              href="/v2"
              className="px-4 py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Staff POS v2</span>
            </Link>
          </div>

          {/* Live Pass Tracker Box */}
          <div className="pt-8">
            <PublicPassTracker />
          </div>
        </div>
      </section>

      {/* Play Passes Pricing Section */}
      <section id="passes" className="py-16 px-4 md:px-8 border-t border-slate-200/80 dark:border-white/10 bg-white/40 dark:bg-slate-900/30">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              Simple, Transparent Passes
            </span>
            <h2 className="font-extrabold text-3xl sm:text-4xl text-slate-900 dark:text-white">
              Choose Your Play Burst
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              All passes include full access to soft-play obstacle course, climbing slides, and ball pit.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {rates.map((rate, index) => {
              const isPopular = rate.minutes === 60;
              return (
                <div
                  key={rate.minutes}
                  className={`p-6 rounded-3xl border transition-all flex flex-col justify-between relative shadow-sm ${
                    isPopular
                      ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30"
                      : "bg-white dark:bg-slate-900/80 border-slate-200 dark:border-white/10 hover:border-slate-300"
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider shadow-sm">
                      Most Popular
                    </span>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                        Tier 0{index + 1}
                      </span>
                      <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>

                    <div>
                      <h3 className="font-extrabold text-2xl text-slate-900 dark:text-white">
                        {rate.minutes} Mins
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {rate.minutes <= 30
                          ? "Quick energy release"
                          : rate.minutes <= 60
                          ? "Standard jungle burst"
                          : "Adventure play session"}
                      </p>
                    </div>

                    <div className="pt-2">
                      <span className="font-mono font-black text-3xl text-emerald-600 dark:text-emerald-400">
                        Nu. {rate.amountNu}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                        per playing child
                      </span>
                    </div>

                    <ul className="space-y-1.5 pt-3 border-t border-slate-200/60 dark:border-white/10 text-xs text-slate-600 dark:text-slate-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Climbing frames & slides</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Mega colorful ball pit</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Parents accompany free</span>
                      </li>
                    </ul>
                  </div>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-xs font-bold text-center transition-all block"
                  >
                    Reserve or Walk In
                  </a>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 max-w-xl mx-auto text-center text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold flex items-center justify-center gap-1.5">
              <Footprints className="h-4 w-4 text-amber-600" /> Grip Socks Required in Play Area
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
              Bring your own grip socks or purchase a fresh pair at our counter for Nu. 50/pair.
            </p>
          </div>
        </div>
      </section>

      {/* Cafe & Restaurant Menu Showcase */}
      <section className="py-16 px-4 md:px-8 border-t border-slate-200/80 dark:border-white/10">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              Fresh Bites & Brews
            </span>
            <h2 className="font-extrabold text-3xl sm:text-4xl text-slate-900 dark:text-white">
              Family Cafe & Dining Menu
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Enjoy freshly brewed coffee, boba tea, steaming momos, and hot pizzas while the kids play.
            </p>
          </div>

          <PublicMenuShowcase menu={menu} />
        </div>
      </section>

      {/* Safety & Hygiene Guarantee */}
      <section className="py-14 px-4 md:px-8 border-t border-slate-200/80 dark:border-white/10 bg-emerald-950/5 dark:bg-emerald-950/20">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="space-y-2">
            <div className="h-10 w-10 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Daily Sanitized & Deep Cleaned
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Every ball, slide, and foam pad is sanitized daily with child-safe hygiene cleaners.
            </p>
          </div>

          <div className="space-y-2">
            <div className="h-10 w-10 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Heart className="h-5 w-5" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Trained Floor Guardians
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Attentive staff stationed inside the play area to ensure safety and friendly guidance.
            </p>
          </div>

          <div className="space-y-2">
            <div className="h-10 w-10 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Real-time Play Timers
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Digital wristbands and online pass tracker so parents never lose track of session time.
            </p>
          </div>
        </div>
      </section>

      {/* Location, Hours & Footer */}
      <footer className="py-12 px-4 md:px-8 border-t border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/80 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1.5">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="font-extrabold text-base text-slate-900 dark:text-white">
                {settings.venueName || "Tumble Jungle"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Thimphu
              </span>
            </div>
            <p className="flex items-center justify-center md:justify-start gap-1">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              <span>{settings.address || "Changjiji, Thimphu, Bhutan"}</span>
            </p>
            <p className="flex items-center justify-center md:justify-start gap-1">
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              <span>Tel: {settings.phone || "17123456"}</span>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-sm"
            >
              WhatsApp Concierge
            </a>
            <Link
              href="/v2"
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all"
            >
              Mobile Till / Staff
            </Link>
            <Link
              href="/v2/admin"
              className="px-4 py-2 rounded-xl border border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 font-bold transition-all"
            >
              Admin Hub
            </Link>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-slate-200 dark:border-white/5 text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} {settings.venueName || "Tumble Jungle"}. Powered by PlayTab v2.
        </div>
      </footer>
    </div>
  );
}
