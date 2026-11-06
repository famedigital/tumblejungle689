"use client";

import { Button } from "@/components/ui/button";
import { thermalPrint } from "@/lib/print-station";

export function PrintButton({
  mode,
  children,
}: {
  mode: "ticket" | "sticker";
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={mode === "ticket" ? "default" : "outline"}
      className="h-11 px-4"
      onClick={() => {
        void thermalPrint(mode);
      }}
    >
      {children}
    </Button>
  );
}
