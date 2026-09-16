import { createClient } from "@supabase/supabase-js";
import { cookieStorage } from "./cookieStorage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Auth is disabled until then."
  );
}

// createClient throws synchronously on an invalid URL, which would otherwise crash
// the whole app (including public marketing pages) before auth is configured.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  { auth: { storage: cookieStorage } }
);
