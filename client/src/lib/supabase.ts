import { createClient } from "@supabase/supabase-js";
import { cookieStorage } from "./cookieStorage";

// The marketing site only ever reads the session (to decide whether the
// header shows "Console Login" or "Dashboard") — it never signs anyone in
// or out. Same Supabase project as the console app, sharing its session via
// a cookie scoped to the shared root domain (VITE_AUTH_COOKIE_DOMAIN).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  { auth: { storage: cookieStorage, autoRefreshToken: false, detectSessionInUrl: false } }
);
