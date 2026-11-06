import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://fxnvsrnruosxndvnteuw.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4bnZzcm5ydW9zeG5kdm50ZXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3ODI3MTcsImV4cCI6MjEwNzM1ODcxN30.cIFLH5anUDT7anL-m3w8YVhrfPkaVhApRRJesdFmjl0";

function resolveUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  ).replace(/\/$/, "");
}

function resolveAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  );
}

let client: SupabaseClient | null = null;

/** Browser/server singleton — one Realtime socket for the till. */
export function getSupabase() {
  if (!client) {
    client = createClient(resolveUrl(), resolveAnonKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
  }
  return client;
}

export const supabase = getSupabase();

export const REALTIME_CHANNEL = "tumble-v2-live";
