"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function Scanner({ to, defaultOpen = false }: { to: string; defaultOpen?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !videoRef.current) return;
    let stopped = false;
    let stopCamera: (() => void) | undefined;
    const video = videoRef.current;

    void import("@zxing/browser").then(async ({ BrowserMultiFormatReader }) => {
      if (stopped) return;
      try {
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (stopped || !result) return;
          stopped = true;
          controls.stop();
          const text = result.getText();
          const match = text.match(/\/t\/([A-Za-z0-9]+)/i);
          const code = (match?.[1] ?? text).trim();
          const url = new URL(to, window.location.origin);
          url.searchParams.set("q", code);
          window.location.assign(`${url.pathname}?${url.searchParams.toString()}`);
        });
        stopCamera = () => controls.stop();
      } catch {
        if (!stopped) setError("The camera could not start. Type the phone number instead.");
      }
    });

    return () => {
      stopped = true;
      stopCamera?.();
    };
  }, [open, to]);

  if (!open) {
    return (
      <Button type="button" variant="outline" className="h-11 px-4" onClick={() => setOpen(true)}>
        Scan QR
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <video ref={videoRef} className="aspect-video w-full max-w-sm rounded-lg bg-black" muted playsInline />
      {error ? <p className="text-sm text-destructive">{error}</p> : <p className="text-sm text-muted-foreground">Point the camera at the ticket QR.</p>}
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Close camera
      </Button>
    </div>
  );
}
