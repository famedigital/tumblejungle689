"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/v2/supabase";
import type { V2PrintJob } from "@/lib/v2/types";
import { Printer } from "lucide-react";

export function CounterPrintBridge() {
  const [lastJob, setLastJob] = useState<V2PrintJob | null>(null);
  const [printCount, setPrintCount] = useState(0);

  useEffect(() => {
    const channel = supabase.channel("counter-print-bridge", {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "print_job" }, ({ payload }) => {
        if (!payload) return;
        const job = payload as V2PrintJob;
        setLastJob(job);
        setPrintCount((c) => c + 1);

        // Play gentle chime
        try {
          const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        } catch {}
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!lastJob) return null;

  return (
    <div className="fixed top-14 right-3 z-50 animate-in slide-in-from-top duration-300 pointer-events-none">
      <div className="max-w-xs rounded-xl bg-slate-900/90 text-white p-2.5 shadow-xl border border-slate-700 text-xs backdrop-blur-md flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
          <Printer className="h-4 w-4" />
        </div>
        <div className="flex-1 truncate">
          <p className="font-bold truncate text-[11px] text-emerald-300">
            {lastJob.title}
          </p>
          <p className="text-[10px] text-slate-400 truncate">
            {lastJob.staffName} ({lastJob.deviceLabel})
          </p>
        </div>
        <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
          #{printCount}
        </span>
      </div>
    </div>
  );
}
