import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, REALTIME_CHANNEL } from "./supabase";

type BroadcastHandler = (payload: Record<string, unknown>) => void;

type LiveHandlers = {
  onVisitCreated?: BroadcastHandler;
  onOrderPlaced?: BroadcastHandler;
  onVisitSettled?: BroadcastHandler;
  onPrintJob?: BroadcastHandler;
  onStatus?: (connected: boolean, status: string) => void;
};

let liveChannel: RealtimeChannel | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalClose = false;
let activeHandlers: LiveHandlers = {};

function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function attachHandlers(channel: RealtimeChannel, handlers: LiveHandlers) {
  if (handlers.onVisitCreated) {
    channel.on("broadcast", { event: "visit_created" }, ({ payload }) => {
      handlers.onVisitCreated?.(payload as Record<string, unknown>);
    });
  }
  if (handlers.onOrderPlaced) {
    channel.on("broadcast", { event: "order_placed" }, ({ payload }) => {
      handlers.onOrderPlaced?.(payload as Record<string, unknown>);
    });
  }
  if (handlers.onVisitSettled) {
    channel.on("broadcast", { event: "visit_settled" }, ({ payload }) => {
      handlers.onVisitSettled?.(payload as Record<string, unknown>);
    });
  }
  if (handlers.onPrintJob) {
    channel.on("broadcast", { event: "print_job" }, ({ payload }) => {
      handlers.onPrintJob?.(payload as Record<string, unknown>);
    });
  }
}

function scheduleReconnect() {
  if (intentionalClose || typeof window === "undefined") return;
  clearReconnect();
  reconnectTimer = setTimeout(() => {
    startLiveChannel(activeHandlers);
  }, 1500);
}

/** Single shared broadcast channel — never open a second tumble-v2-live join. */
export function startLiveChannel(handlers: LiveHandlers) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  intentionalClose = false;
  activeHandlers = handlers;
  clearReconnect();

  if (liveChannel) {
    supabase.removeChannel(liveChannel);
    liveChannel = null;
  }

  const channel = supabase.channel(REALTIME_CHANNEL, {
    config: {
      broadcast: { self: true, ack: false },
    },
  });

  attachHandlers(channel, handlers);

  channel.subscribe((status) => {
    const connected = status === "SUBSCRIBED";
    handlers.onStatus?.(connected, status);

    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      if (!intentionalClose) scheduleReconnect();
    }
  });

  liveChannel = channel;

  return () => {
    intentionalClose = true;
    clearReconnect();
    if (liveChannel === channel) {
      supabase.removeChannel(channel);
      liveChannel = null;
    }
    handlers.onStatus?.(false, "CLOSED");
  };
}

export async function broadcastLive(event: string, payload: unknown) {
  if (typeof window === "undefined") return;

  const channel =
    liveChannel ??
    supabase.channel(REALTIME_CHANNEL, {
      config: { broadcast: { self: true, ack: false } },
    });

  if (channel !== liveChannel) {
    // Opportunistic one-shot: join then send (used if store not yet live).
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          resolve();
        }
      });
      setTimeout(() => resolve(), 2500);
    });
  }

  await channel.send({
    type: "broadcast",
    event,
    payload,
  });
}

export function isLiveJoined() {
  return Boolean(liveChannel);
}
