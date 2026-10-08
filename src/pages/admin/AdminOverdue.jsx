import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import Layout from "../../components/Layout";
import StatCard from "../../components/StatCard";
import LoadingSpinner from "../../components/LoadingSpinner";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";

export default function AdminOverdue() {
  const [overdueRecords, setOverdueRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");

  const [returnDialog, setReturnDialog] = useState({ isOpen: false, item: null });
  const [returningId, setReturningId] = useState(null);
  const [notification, setNotification] = useState(null);

  const fetchOverdueData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Trigger automatic overdue check & fine recalculation (best effort)
      try { await supabase.rpc("refresh_overdue_borrowings"); } catch (_) {}

      const { data, error } = await supabase
        .from("borrowings")
        .select(`
          id,
          user_id,
          book_id,
          borrowed_at,
          due_date,
          returned_at,
          status,
          fine,
          profiles ( name, email ),
          books ( title, author, isbn, image_url )
        `)
        .is("returned_at", null)
        .lt("due_date", new Date().toISOString())
        .order("due_date", { ascending: true });

      if (error) throw error;

      const now = new Date();
      const enriched = (data || []).map((b) => {
        const dueDate = new Date(b.due_date);
        const diffMs = now - dueDate;
        const daysOverdue = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        const calculatedFine = daysOverdue * 5;
        const isCritical = daysOverdue > 7;

        return {
          ...b,
          daysOverdue,
          calculatedFine,
          isCritical,
        };
      });

      setOverdueRecords(enriched);
    } catch (err) {
      console.error("Error loading overdue records:", err);
      setNotification({ type: "error", message: "Failed to load overdue records." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverdueData();
  }, [fetchOverdueData]);

  const filteredRecords = useMemo(() => {
    return overdueRecords.filter((b) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mPatron = b.profiles?.name?.toLowerCase().includes(q);
        const mEmail = b.profiles?.email?.toLowerCase().includes(q);
        const mTitle = b.books?.title?.toLowerCase().includes(q);
        if (!mPatron && !mEmail && !mTitle) return false;
      }

      if (severityFilter === "critical" && !b.isCritical) return false;
      if (severityFilter === "moderate" && b.isCritical) return false;

      return true;
    });
  }, [overdueRecords, searchQuery, severityFilter]);

  const handleReturnConfirm = async () => {
    if (!returnDialog.item) return;
    const borrowingId = returnDialog.item.id;

    try {
      setReturningId(borrowingId);
      const { data, error } = await supabase.rpc("return_book", {
        p_borrowing_id: borrowingId,
      });

      if (error) throw error;

      setNotification({
        type: "success",
        message: `Processed return for "${returnDialog.item.books?.title}". Recorded fine: ₹${data?.fine || 0}.`,
      });

      setReturnDialog({ isOpen: false, item: null });
      await fetchOverdueData();
    } catch (err) {
      console.error("Return error:", err);
      setNotification({
        type: "error",
        message: err.message || "Failed to process return.",
      });
    } finally {
      setReturningId(null);
    }
  };

  const totalFinesAccrued = overdueRecords.reduce((acc, r) => acc + r.calculatedFine, 0);
  const criticalCount = overdueRecords.filter((r) => r.isCritical).length;
  const uniquePatrons = new Set(overdueRecords.map((r) => r.user_id)).size;

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Overdue Records & Fine Tracking</h1>
            <p>Active violations past the 14-day borrowing duration with fine computation at ₹5/day.</p>
          </div>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={fetchOverdueData}
            title="Recalculate overdue records"
          >
            🔄 Refresh Calculations
          </button>
        </div>

        {/* Notifications */}
        {notification && (
          <div className={`alert-banner ${notification.type === "error" ? "alert-error" : "alert-success"}`}>
            <span>{notification.type === "error" ? "⚠" : "✓"} {notification.message}</span>
            <button className="alert-close" onClick={() => setNotification(null)}>✕</button>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="stats-grid">
          <StatCard
            title="Total Overdue Titles"
            value={overdueRecords.length}
            icon="⚠️"
            subtitle="Pending unreturned books"
            color="rose"
          />
          <StatCard
            title="Patrons with Overdues"
            value={uniquePatrons}
            icon="👥"
            subtitle="Distinct borrowers"
            color="amber"
          />
          <StatCard
            title="Critical Delinquencies"
            value={criticalCount}
            icon="🚨"
            subtitle="Over 7 days late"
            color="rose"
          />
          <StatCard
            title="Uncollected Fines"
            value={`₹${totalFinesAccrued}`}
            icon="💰"
            subtitle="Accumulated late charges"
            color="purple"
          />
        </div>

        {/* Search & Filters */}
        <div className="search-filter-bar mt-4">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by patron name, email, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>

          <div className="filter-controls">
            <select
              className="select-control"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">All Overdue ({overdueRecords.length})</option>
              <option value="critical">Critical (&gt; 7 Days)</option>
              <option value="moderate">Moderate (1-7 Days)</option>
            </select>
          </div>
        </div>

        {/* Overdue Table */}
        {loading ? (
          <LoadingSpinner message="Calculating overdue fines..." />
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            icon="🎉"
            title="No overdue books!"
            description="All borrowed titles are currently within the 14-day borrowing window."
          />
        ) : (
          <div className="borrowings-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patron</th>
                  <th>Book</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th>Severity</th>
                  <th>Calculated Fine</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => {
                  const dueDateStr = new Date(r.due_date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <tr key={r.id} className="row-overdue">
                      <td className="user-cell">
                        <div className="avatar-sm">
                          {(r.profiles?.name || r.profiles?.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{r.profiles?.name || "Member"}</strong>
                          <span className="table-subtext">{r.profiles?.email}</span>
                        </div>
                      </td>

                      <td className="book-cell">
                        <img
                          src={r.books?.image_url || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=100&q=80"}
                          alt={r.books?.title}
                          className="table-book-thumb"
                          onError={(e) => {
                            e.target.src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=100&q=80";
                          }}
                        />
                        <div>
                          <strong>{r.books?.title}</strong>
                          <span className="table-subtext">by {r.books?.author}</span>
                        </div>
                      </td>

                      <td>
                        <span className="text-danger font-bold">{dueDateStr}</span>
                      </td>

                      <td>
                        <span className="badge badge-overdue font-bold">
                          {r.daysOverdue} {r.daysOverdue === 1 ? "day" : "days"} late
                        </span>
                      </td>

                      <td>
                        {r.isCritical ? (
                          <span className="badge badge-danger">🚨 Critical (&gt;7d)</span>
                        ) : (
                          <span className="badge badge-warning">⚠️ Moderate</span>
                        )}
                      </td>

                      <td>
                        <strong className="text-danger">₹{r.calculatedFine}</strong>
                        <span className="text-xs text-muted block">(@ ₹5/day)</span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="btn-outline-sm"
                          onClick={() => setReturnDialog({ isOpen: true, item: r })}
                          disabled={returningId === r.id}
                        >
                          {returningId === r.id ? "Checking in..." : "Force Return"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Force Return Dialog */}
        <ConfirmDialog
          isOpen={returnDialog.isOpen}
          title="Process Overdue Return"
          message={
            returnDialog.item
              ? `Check in "${returnDialog.item.books?.title}" for ${
                  returnDialog.item.profiles?.name || returnDialog.item.profiles?.email
                }? Late fine of ₹${returnDialog.item.calculatedFine} will be recorded.`
              : ""
          }
          confirmText="Confirm Check-In"
          isLoading={returningId !== null}
          onConfirm={handleReturnConfirm}
          onCancel={() => setReturnDialog({ isOpen: false, item: null })}
        />
      </div>
    </Layout>
  );
}
