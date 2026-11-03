"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GlassBadge } from "@/components/ui/glass/GlassBadge";
import { GlassButton } from "@/components/ui/glass/GlassButton";
import { GlassCard } from "@/components/ui/glass/GlassCard";
import { parseVoiceIntent } from "@/lib/pulse/parseVoiceIntent";
import type { VoiceTillCommand } from "@/lib/pulse/voiceIntentSchema";

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

type SpeechRecognitionInstance = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } };
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onCommand: (cmd: VoiceTillCommand) => void;
};

export function VoiceTillModal({ open, onClose, onCommand }: Props) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const SpeechRecognition = useMemo(() => getSpeechRecognition(), []);

  const draft = useMemo(() => (transcript.trim() ? parseVoiceIntent(transcript) : null), [transcript]);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";
    rec.onresult = (ev) => {
      let chunk = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        chunk += ev.results[i][0].transcript;
      }
      setTranscript((prev) => {
        const next = prev ? `${prev} ${chunk}` : chunk;
        return next.trim();
      });
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [SpeechRecognition]);

  const toggleListen = useCallback(() => {
    if (listening) stopListening();
    else startListening();
  }, [listening, startListening, stopListening]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        toggleListen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggleListen]);

  useEffect(() => {
    if (!open) {
      stopListening();
      setTranscript("");
    }
  }, [open, stopListening]);

  const apply = () => {
    if (!draft) return;
    onCommand(draft);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg border-slate-200/80 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">Quick Voice Till</DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-300">
            Hold <kbd className="rounded border px-1">Space</kbd> or tap mic. Example: &quot;2 kids 1 hour plus 2 socks&quot;
          </DialogDescription>
        </DialogHeader>

        {!SpeechRecognition ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">Web Speech API is not available in this browser.</p>
        ) : (
          <>
            <GlassButton
              type="button"
              variant={listening ? "rose" : "emerald"}
              size="lg"
              className="min-h-11 w-full"
              onClick={toggleListen}
            >
              {listening ? <MicOff className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
              {listening ? "Stop listening" : "Start listening"}
            </GlassButton>

            <GlassCard padding="sm" variant="tinted" className="mt-3 min-h-[4rem]">
              <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Transcript</p>
              <p className="mt-1 text-base text-slate-800 dark:text-slate-100">{transcript || "—"}</p>
            </GlassCard>

            {draft ? (
              <GlassCard padding="sm" className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <GlassBadge tone="active">{draft.action.replace("_", " ")}</GlassBadge>
                  <GlassBadge tone="neutral">{Math.round(draft.confidence * 100)}% confidence</GlassBadge>
                </div>
                <pre className="mt-2 max-h-40 overflow-auto text-xs text-slate-700 dark:text-slate-300">
                  {JSON.stringify(draft, null, 2)}
                </pre>
              </GlassCard>
            ) : null}

            <div className="mt-4 flex gap-2">
              <GlassButton type="button" variant="ghost" size="lg" className="min-h-11 flex-1" onClick={onClose}>
                <X className="size-4" aria-hidden />
                Cancel
              </GlassButton>
              <GlassButton
                type="button"
                variant="teal"
                size="lg"
                className="min-h-11 flex-1"
                disabled={!draft}
                onClick={apply}
              >
                Apply command
              </GlassButton>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
