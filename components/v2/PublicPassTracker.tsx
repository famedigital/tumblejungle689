"use client";

import { useState, useMemo } from "react";
import { Search, Clock, AlertCircle, Sparkles } from "lucide-react";
import type { VisitView } from "@/lib/types";

export function PublicPassTracker() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisitView | null>(null);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentTime] = useState(() => Date.now());

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setErrorMsg("");
    setSearched(true);
    setResult(null);

    try {
      const res = await fetch("/api/v2/bootstrap");
      if (!res.ok) throw new Error("Could not connect to tracker");
      const data = await res.json();
      const visits: VisitView[] = data.visits || [];

      const cleanQ = q.toLowerCase().replace(/[^a-z0-9]/g, "");
      const found = visits.find((v) => {
        if (v.status !== "open") return false;
        const codeClean = v.code.toLowerCase().replace(/[^a-z0-9]/g, "");
        const phoneClean = v.phone.replace(/\D/g, "");
        return codeClean.includes(cleanQ) || phoneClean.includes(cleanQ);
      });

      if (found) {
        setResult(found);
      } else {
        setErrorMsg("No active play pass found for that number or code. Please check with the counter.");
      }
    } catch {
      setErrorMsg("Unable to check status right now. Please ask our front desk.");
    } finally {
      setLoading(false);
    }
  };

  const { diffMin, isOvertime } = useMemo(() => {
    if (!result) return { diffMin: 0, isOvertime: false };
    const paidUntilMs = new Date(result.paidUntil).getTime();
    const diff = Math.round((paidUntilMs - currentTime) / 60000);
    return { diffMin: diff, isOvertime: diff < 0 };
  }, [result, currentTime]);

  return (
    <div className="w-full max-w-xl mx-auto p-5 md:p-6 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 shadow-xl shadow-emerald-950/5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <Clock className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-extrabold text-sm md:text-base text-slate-900 dark:text-white">
            Live Play Pass Timer
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Check how many minutes your child has left on the floor
          </p>
        </div>
      </div>

      <form onSubmit={handleLookup} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Enter phone number or pass code (e.g. 17649720 or TJ-4)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs md:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? <Sparkles className="h-4 w-4 animate-spin" /> : "Check"}
        </button>
      </form>

      {/* Result Card */}
      {result && (
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 animate-in fade-in space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                Pass {result.code}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {result.guardianName || "Child"} • {result.childCount} child(ren)
              </p>
            </div>

            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold ${
                isOvertime
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse"
                  : diffMin <= 10
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>
                {isOvertime ? `${Math.abs(diffMin)}m OVERTIME` : `${diffMin}m remaining`}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Valid until {new Date(result.paidUntil).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      )}

      {/* Error state */}
      {searched && errorMsg && !result && (
        <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
