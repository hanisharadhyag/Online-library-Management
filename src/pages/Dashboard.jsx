import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmDialog from "../components/ConfirmDialog";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({
    totalBorrowed: 0,
    currentlyBorrowed: 0,
    dueSoon: 0,
    overdue: 0,
    totalFines: 0,
  });
  const [activeBorrowings, setActiveBorrowings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [returningId, setReturningId] = useState(null);
  const [returnDialog, setReturnDialog] = useState({ isOpen: false, item: null });
  const [actionMessage, setActionMessage] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Trigger automatic overdue check on load (best effort)
      try { await supabase.rpc("refresh_overdue_borrowings"); } catch (_) {}

      // Fetch user's borrowings with book details
      const { data: borrowings, error } = await supabase
        .from("borrowings")
        .select(`
          id,
          book_id,
          borrowed_at,
          due_date,
          returned_at,
          status,
          fine,
          books (
            id,
            title,
            author,
            category,
            image_url,
            available_copies,
            total_copies
          )
        `)
        .eq("user_id", user.id)
        .order("borrowed_at", { ascending: false });

      if (error) throw error;

      const list = borrowings || [];
      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      let currentlyCount = 0;
      let dueSoonCount = 0;
      let overdueCount = 0;
      let totalFinesSum = 0;
      const active = [];

      list.forEach((b) => {
        totalFinesSum += Number(b.fine || 0);

        if (!b.returned_at) {
          currentlyCount++;
          active.push(b);
          const dueDate = new Date(b.due_date);

          if (dueDate < now) {
            overdueCount++;
          } else if (dueDate <= threeDaysFromNow) {
            dueSoonCount++;
          }
        }
      });

      setStats({
        totalBorrowed: list.length,
        currentlyBorrowed: currentlyCount,
        dueSoon: dueSoonCount,
        overdue: overdueCount,
        totalFines: totalFinesSum,
      });

      setActiveBorrowings(active);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleReturnConfirm = async () => {
    if (!returnDialog.item) return;
    const borrowingId = returnDialog.item.id;

    try {
      setReturningId(borrowingId);
      const { data, error } = await supabase.rpc("return_book", {
        p_borrowing_id: borrowingId,
      });

      if (error) throw error;

      const fineAmount = data?.fine || 0;
      setActionMessage({
        type: "success",
        text: fineAmount > 0
          ? `Book returned! An overdue fine of ₹${fineAmount} was recorded.`
          : "Book returned successfully with no fines!",
      });

      setReturnDialog({ isOpen: false, item: null });
      await fetchDashboardData();
    } catch (err) {
      console.error("Return book error:", err);
      setActionMessage({
        type: "error",
        text: err.message || "Failed to return book. Please try again.",
      });
    } finally {
      setReturningId(null);
    }
  };

  const displayName = profile?.name || user?.user_metadata?.name || "Library Member";

  return (
    <Layout>
      <div className="page-container">
        {/* Welcome Banner */}
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Welcome back, {displayName}! 👋</h2>
            <p>
              Track your borrowed titles, upcoming due dates, and discover what to read next.
            </p>
          </div>
          <div className="welcome-actions">
            <Link to="/books" className="btn-primary">
              Browse Books 📖
            </Link>
          </div>
        </div>

        {/* Feedback Alert */}
        {actionMessage && (
          <div className={`alert-banner ${actionMessage.type === "error" ? "alert-error" : "alert-success"}`}>
            <span>{actionMessage.type === "error" ? "⚠" : "✓"} {actionMessage.text}</span>
            <button className="alert-close" onClick={() => setActionMessage(null)}>✕</button>
          </div>
        )}

        {/* Overdue Warning Alert */}
        {stats.overdue > 0 && (
          <div className="alert-banner alert-danger">
            <span className="alert-icon">⚠️</span>
            <div className="alert-text">
              <strong>Action Required: You have {stats.overdue} overdue book(s)!</strong>
              <p>Late returns incur a fee of ₹5 per day. Please return them promptly in My Books.</p>
            </div>
            <Link to="/my-books" className="btn-danger-sm">
              View Overdue Books
            </Link>
          </div>
        )}

        {/* Analytics Stat Cards */}
        <div className="stats-grid">
          <StatCard
            title="Total Borrowed"
            value={stats.totalBorrowed}
            icon="📚"
            subtitle="Lifetime borrowings"
            color="indigo"
          />
          <StatCard
            title="Currently Reading"
            value={stats.currentlyBorrowed}
            icon="📖"
            subtitle="Books in your possession"
            color="purple"
          />
          <StatCard
            title="Due Soon"
            value={stats.dueSoon}
            icon="⏰"
            subtitle="Due within 3 days"
            color="amber"
          />
          <StatCard
            title="Overdue"
            value={stats.overdue}
            icon="⚠️"
            subtitle="Past return deadline"
            color="rose"
          />
          <StatCard
            title="Total Fines"
            value={`₹${stats.totalFines}`}
            icon="💰"
            subtitle="Accrued late fees"
            color={stats.totalFines > 0 ? "rose" : "emerald"}
          />
        </div>

        {/* Continue Reading Section */}
        <div className="dashboard-section">
          <div className="section-header">
            <div>
              <h3>Continue Reading</h3>
              <p>Books currently borrowed and awaiting return</p>
            </div>
            <Link to="/my-books" className="btn-link">
              View All History →
            </Link>
          </div>

          {loading ? (
            <LoadingSpinner message="Loading your books..." />
          ) : activeBorrowings.length === 0 ? (
            <div className="empty-card">
              <span className="empty-icon">📖</span>
              <h4>No books currently borrowed</h4>
              <p>Your library shelf is clear. Explore our catalog and pick your next favorite read!</p>
              <Link to="/books" className="btn-primary-sm mt-3">
                Explore Catalog
              </Link>
            </div>
          ) : (
            <div className="active-borrowings-grid">
              {activeBorrowings.map((b) => {
                const isOverdue = new Date(b.due_date) < new Date();
                const dueDateStr = new Date(b.due_date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <div key={b.id} className={`borrowing-card ${isOverdue ? "borrowing-card-overdue" : ""}`}>
                    <img
                      src={b.books?.image_url || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=300&q=80"}
                      alt={b.books?.title}
                      className="borrowing-cover"
                      onError={(e) => {
                        e.target.src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=300&q=80";
                      }}
                    />
                    <div className="borrowing-details">
                      <div className="borrowing-badge-row">
                        <span className="badge badge-category">{b.books?.category || "General"}</span>
                        <StatusBadge status={isOverdue ? "overdue" : "borrowed"} />
                      </div>
                      <h4 className="borrowing-title">{b.books?.title}</h4>
                      <p className="borrowing-author">by {b.books?.author}</p>
                      <div className="borrowing-meta">
                        <span className="meta-due">
                          Due Date: <strong>{dueDateStr}</strong>
                        </span>
                        {b.fine > 0 && <span className="meta-fine">Fine: ₹{b.fine}</span>}
                      </div>
                      <button
                        type="button"
                        className="btn-outline-sm mt-2"
                        onClick={() => setReturnDialog({ isOpen: true, item: b })}
                        disabled={returningId === b.id}
                      >
                        {returningId === b.id ? "Returning..." : "Return Book"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Links Footer */}
        <div className="quick-actions-card">
          <h3>Quick Navigation</h3>
          <div className="quick-actions-row">
            <Link to="/books" className="quick-action-btn">
              <span>📖</span>
              <div>
                <strong>Browse Catalog</strong>
                <small>Explore 1,200+ available titles</small>
              </div>
            </Link>
            <Link to="/my-books" className="quick-action-btn">
              <span>📚</span>
              <div>
                <strong>My Borrowings</strong>
                <small>Review history & return books</small>
              </div>
            </Link>
            <Link to="/profile" className="quick-action-btn">
              <span>👤</span>
              <div>
                <strong>Account Profile</strong>
                <small>Manage your library credentials</small>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Return Confirmation Dialog */}
      <ConfirmDialog
        isOpen={returnDialog.isOpen}
        title="Return Book"
        message={
          returnDialog.item
            ? `Are you sure you want to return "${returnDialog.item.books?.title}"? ${
                new Date(returnDialog.item.due_date) < new Date()
                  ? "Note: This book is overdue and a late fine of ₹5/day will be calculated."
                  : "Returning on time incurs zero fine."
              }`
            : ""
        }
        confirmText="Confirm Return"
        isLoading={returningId !== null}
        onConfirm={handleReturnConfirm}
        onCancel={() => setReturnDialog({ isOpen: false, item: null })}
      />
    </Layout>
  );
}