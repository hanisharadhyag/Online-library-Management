import { useState, useEffect } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import ConfigBanner from "./ConfigBanner";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    // Check count of user's overdue books
    supabase
      .from("borrowings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "overdue")
      .then(({ count, error }) => {
        if (!error && count !== null) {
          setOverdueCount(count);
        }
      });
  }, [user]);

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <Navbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          activeOverdueCount={overdueCount}
        />
        <main className="content-area">
          <ConfigBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
