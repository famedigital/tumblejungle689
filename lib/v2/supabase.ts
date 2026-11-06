import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://fxnvsrnruosxndvnteuw.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4bnZzcm5ydW9zeG5kdm50ZXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3ODI3MTcsImV4cCI6MjEwNzM1ODcxN30.cIFLH5anUDT7anL-m3w8YVhrfPkaVhApRRJesdFmjl0";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

// Reusable browser and node client singleton
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

export const REALTIME_CHANNEL = "tumble-v2-live";
