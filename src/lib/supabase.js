import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== "https://your-project-id.supabase.co" &&
  !supabaseUrl.includes("your-project-id")
);

// Fallback dummy client if not yet configured, to prevent app crashing before keys are set
const dummyUrl = "https://placeholder-project.supabase.co";
const dummyKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummyKey";

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : dummyUrl,
  isSupabaseConfigured ? supabaseAnonKey : dummyKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
