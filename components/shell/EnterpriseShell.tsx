"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { QuickUnlock } from "@/components/auth/QuickUnlock";
import { VoiceTillModal } from "@/components/pulse/VoiceTillModal";
import { HeaderTopBar } from "@/components/shell/HeaderTopBar";
import { PersonaSwitcherHost } from "@/components/shell/persona-switcher-host";
import { createIdleWatcher } from "@/lib/security/idleLock";
import type { VoiceTillCommand } from "@/lib/pulse/voiceIntentSchema";

export interface EnterpriseShellProps {
  outletLabel: string;
  children: ReactNode;
  capacity?: number;
  activeJumpers?: number;
  /** When true, idle lock applies on cashier/admin routes (default: auto-detect from pathname). */
  sensitive?: boolean;
}

function pathIsSensitive(pathname: string): boolean {
  return pathname.includes("cashier") || pathname.includes("admin");
}

async function verifyTillPin(pin: string): Promise<boolean> {
  try {
    const response = await fetch("/api/till/pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: pin }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    return response.ok && Boolean(body.ok);
  } catch {
    return false;
  }
}

export function EnterpriseShell({
  outletLabel,
  children,
  capacity,
  activeJumpers,
  sensitive,
}: EnterpriseShellProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const isSensitiveRoute = useMemo(
    () => (sensitive !== undefined ? sensitive : pathIsSensitive(pathname)),
    [pathname, sensitive],
  );

  const [locked, setLocked] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const handleUnlock = useCallback(async (pin: string) => {
    const ok = await verifyTillPin(pin);
    if (ok) setLocked(false);
    return ok;
  }, []);

  const handleVoice = useCallback(
    (cmd: VoiceTillCommand) => {
      setVoiceOpen(false);
      if (cmd.action === "admission") {
        router.push("/desk");
        return;
      }
      if (cmd.action === "lookup" || cmd.action === "extend_play" || cmd.action === "settle") {
        const q = cmd.targetTicketOrPhone || cmd.guardianName;
        router.push(q ? `/cashier?q=${encodeURIComponent(q)}` : "/cashier");
        return;
      }
      if (cmd.action === "add_item") {
        const outlet = cmd.items?.[0]?.outlet === "restaurant" ? "restaurant" : "cafe";
        router.push(`/counter/${outlet}`);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!isSensitiveRoute || locked) return undefined;
    return createIdleWatcher(() => setLocked(true));
  }, [isSensitiveRoute, locked]);

  const showLock = isSensitiveRoute && locked;

  return (
    <div className="tj-canvas flex min-h-dvh flex-col pb-24">
      <HeaderTopBar
        outletLabel={outletLabel}
        activeJumpers={activeJumpers}
        capacity={capacity}
        onVoice={() => setVoiceOpen(true)}
        onSearch={() => router.push("/cashier")}
        onLock={isSensitiveRoute ? () => setLocked(true) : undefined}
      />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-4 sm:px-4 sm:py-6">{children}</main>
      <PersonaSwitcherHost />
      <QuickUnlock
        key={showLock ? "locked" : "unlocked"}
        open={showLock}
        onUnlock={handleUnlock}
      />
      <VoiceTillModal open={voiceOpen} onClose={() => setVoiceOpen(false)} onCommand={handleVoice} />
    </div>
  );
}
