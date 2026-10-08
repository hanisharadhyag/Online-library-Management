import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import StatCard from "../components/StatCard";

export default function Profile() {
  const { user, profile, role, isAdmin, updateProfileName } = useAuth();
  const [name, setName] = useState(profile?.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [memberStats, setMemberStats] = useState({
    borrowed: 0,
    returned: 0,
    overdue: 0,
    fines: 0,
  });

  useEffect(() => {
    if (profile?.name) {
      setName(profile.name);
    }
  }, [profile]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    supabase
      .from("borrowings")
      .select("id, status, fine, returned_at")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (!error && data) {
          let returned = 0;
          let overdue = 0;
          let fines = 0;

          data.forEach((b) => {
            if (b.returned_at) returned++;
            if (b.status === "overdue" && !b.returned_at) overdue++;
            fines += Number(b.fine || 0);
          });

          setMemberStats({
            borrowed: data.length,
            returned,
            overdue,
            fines,
          });
        }
      });
  }, [user]);

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      setMessage(null);
      await updateProfileName(name.trim());
      setMessage({ type: "success", text: "Profile name updated successfully!" });
    } catch (err) {
      console.error("Save name error:", err);
      setMessage({ type: "error", text: err.message || "Failed to update profile name." });
    } finally {
      setSaving(false);
    }
  };

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Recently";

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1>Member Profile</h1>
            <p>Review your personal library credentials, membership role, and reading track record.</p>
          </div>
        </div>

        {message && (
          <div className={`alert-banner ${message.type === "error" ? "alert-error" : "alert-success"}`}>
            <span>{message.type === "error" ? "⚠" : "✓"} {message.text}</span>
            <button className="alert-close" onClick={() => setMessage(null)}>✕</button>
          </div>
        )}

        <div className="profile-layout-grid">
          {/* Profile Identity Card */}
          <div className="profile-card">
            <div className="profile-hero">
              <div className="profile-avatar-large">
                {(profile?.name || user?.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="profile-hero-info">
                <h2>{profile?.name || "Library User"}</h2>
                <p className="profile-email">{user?.email}</p>
                <div className="profile-badges-row">
                  <StatusBadge status={role} label={isAdmin ? "System Administrator" : "Library Member"} />
                  <span className="badge badge-default">Member since {memberSince}</span>
                </div>
              </div>
            </div>

            <hr className="profile-divider" />

            <form onSubmit={handleSaveName} className="profile-form">
              <h3>Edit Personal Information</h3>
              <div className="input-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>

              <div className="input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="input-disabled"
                />
                <small className="input-hint">Email address is managed through authentication security.</small>
              </div>

              <div className="input-group">
                <label>Role</label>
                <input
                  type="text"
                  value={role === "admin" ? "Administrator" : "Standard Member"}
                  disabled
                  className="input-disabled"
                />
                <small className="input-hint">Role privileges are controlled by administrators via RLS.</small>
              </div>

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving Changes..." : "Save Profile"}
              </button>
            </form>
          </div>

          {/* Activity Overview */}
          <div className="profile-activity-col">
            <h3>Your Reading Summary</h3>
            <div className="profile-stats-grid">
              <StatCard
                title="Total Borrowed"
                value={memberStats.borrowed}
                icon="📚"
                subtitle="All-time titles"
                color="indigo"
              />
              <StatCard
                title="Successfully Returned"
                value={memberStats.returned}
                icon="✓"
                subtitle="Books checked back in"
                color="emerald"
              />
              <StatCard
                title="Overdue"
                value={memberStats.overdue}
                icon="⚠️"
                subtitle="Currently past deadline"
                color="rose"
              />
              <StatCard
                title="Total Fines Paid/Due"
                value={`₹${memberStats.fines}`}
                icon="💰"
                subtitle="Late fee charges"
                color={memberStats.fines > 0 ? "rose" : "purple"}
              />
            </div>

            <div className="card-box mt-4">
              <h4>Library Guidelines</h4>
              <ul className="guidelines-list">
                <li>✓ Standard loan duration is <strong>14 calendar days</strong> per title.</li>
                <li>✓ Overdue return fee is <strong>₹5 per day</strong> beyond the due date.</li>
                <li>✓ You can borrow any book with at least 1 copy available.</li>
                <li>✓ Each user can have one active copy of a specific title at a time.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
