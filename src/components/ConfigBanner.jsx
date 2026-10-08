import { isSupabaseConfigured } from "../lib/supabase";

export default function ConfigBanner() {
  if (isSupabaseConfigured) return null;

  return (
    <div className="config-alert-banner">
      <div className="config-alert-content">
        <div className="config-alert-icon">⚡</div>
        <div>
          <h4>Supabase Project Setup Required</h4>
          <p>
            To connect to your database: Add your <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code> and run the provided{" "}
            <code>supabase-schema.sql</code> script in your Supabase SQL Editor.
          </p>
        </div>
      </div>
    </div>
  );
}
