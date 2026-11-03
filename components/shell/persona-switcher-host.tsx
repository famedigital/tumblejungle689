"use client";

import { Suspense } from "react";
import { PersonaSwitcher } from "@/components/shell/PersonaSwitcher";

export function PersonaSwitcherHost() {
  return (
    <Suspense fallback={null}>
      <PersonaSwitcher />
    </Suspense>
  );
}
