"use client";

import { Button } from "@/components/ui/button";

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
        document.body.dataset.print = mode;
        window.print();
      }}
    >
      {children}
    </Button>
  );
}
