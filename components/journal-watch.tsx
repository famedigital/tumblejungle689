"use client";

import { useEffect, useRef, useState } from "react";
import { journalRef, parseJournal } from "@/lib/journal";
import { polePostJournal } from "@/lib/pole";

export function JournalWatch({ amountNu, active }: { amountNu: number; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [note, setNote] = useState("Hold the bank success screen up to this camera.");

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    let stop = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let worker: { recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> } | null = null;

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stop || !video) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        const { createWorker } = await import("tesseract.js");
        worker = await createWorker("eng");
        if (stop) {
          await worker.terminate();
          return;
        }
        const canvas = document.createElement("canvas");
        timer = window.setInterval(() => {
          if (!video.videoWidth || !worker) return;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(video, 0, 0);
          void worker
            .recognize(canvas)
            .then(({ data }) => {
              if (stop) return;
              const parsed = parseJournal(data.text || "");
              const ref = journalRef(parsed);
              if (!ref) {
                setNote("Looking for Jrnl or RRNO.");
                return;
              }
              if (parsed.amount != null && Math.abs(parsed.amount - amountNu) > 1) {
                setNote("That amount does not match this QR.");
                return;
              }
              setNote(parsed.journalId ? `Jrnl ${parsed.journalId}` : `RRNO ${parsed.rrn}`);
              polePostJournal(ref, parsed.amount);
            })
            .catch(() => undefined);
        }, 1600);
      } catch {
        if (!stop) setNote("Camera is unavailable. Type the journal on the till.");
      }
    })();

    return () => {
      stop = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      void worker?.terminate();
    };
  }, [active, amountNu]);

  if (!active) return null;

  return (
    <div className="mt-4 w-full max-w-sm text-left">
      <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Journal scan</p>
      <video ref={videoRef} muted playsInline className="mt-2 aspect-video w-full rounded-2xl bg-black object-cover" />
      <p className="mt-2 text-base">{note}</p>
    </div>
  );
}
