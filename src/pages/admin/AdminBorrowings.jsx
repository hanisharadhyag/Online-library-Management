import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import Layout from "../../components/Layout";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";

export default function AdminBorrowings() {
  const [borrowings, setBorrowings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [returnDialog, setReturnDialog] = useState({ isOpen: false, item: null });
  const [returningId, setReturningId] = useState(null);
  const [notification, setNotification] = useState(null);

  const fetchAllBorrowings = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Trigger automatic overdue check (best effort)
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
          profiles (
            name,
            email
          ),
          books (
            title,
            author,
            isbn,
            category,
            image_url
          )
        `)
        .order("borrowed_at", { ascending: false });

      if (error) throw error;
      setBorrowings(data || []);
    } catch (err) {
      console.error("Error loading all borrowings:", err);
      setNotification({ type: "error", message: "Failed to load circulation records." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllBorrowings();
  }, [fetchAllBorrowings]);

  const filteredBorrowings = useMemo(() => {
    const now = new Date();
    return borrowings.filter((b) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mMember = b.profiles?.name?.toLowerCase().includes(q);
        const mEmail = b.profiles?.email?.toLowerCase().includes(q);
        const mTitle = b.books?.title?.toLowerCase().includes(q);
        const mAuthor = b.books?.author?.toLowerCase().includes(q);
        if (!mMember && !mEmail && !mTitle && !mAuthor) return false;
      }

      const isReturned = b.returned_at !== null;
      const isOverdue = !isReturned && (new Date(b.due_date) < now || b.status === "overdue");

      if (statusFilter === "borrowed" && isReturned) return false;
      if (statusFilter === "returned" && !isReturned) return false;
      if (statusFilter === "overdue" && !isOverdue) return false;

      return true;
    });
  }, [borrowings, searchQuery, statusFilter]);

  const handleAdminReturn = async () => {
    if (!returnDialog.item) return;
    const borrowingId = returnDialog.item.id;

    try {
      setReturningId(borrowingId);
      const { data, error } = await supabase.rpc("return_book", {
        p_borrowing_id: borrowingId,
      });

      if (error) throw error;

      const fineAmount = data?.fine || 0;
      setNotification({
        type: "success",
        message: `Book check-in confirmed! ${
          fineAmount > 0 ? `Late fine assessed: ₹${fineAmount}.` : "Zero fines accrued."
        }`,
      });

      setReturnDialog({ isOpen: false, item: null });
      await fetchAllBorrowings();
    } catch (err) {
      console.error("Admin return error:", err);
      setNotification({
        type: "error",
        message: err.message || "Failed to check in book.",
      });
    } finally {
      setReturningId(null);
    }
  };

  const activeCount = borrowings.filter((b) => !b.returned_at).length;
  const overdueCount = borrowings.filter(
    (b) => !b.returned_at && new Date(b.due_date) < new Date()
  ).length;

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Circulation & Borrowings</h1>
            <p>Comprehensive transaction log of all library check-outs, returns, and overdue fees.</p>
          </div>
          <div className="header-meta-pills">
            <span className="badge badge-borrowed">{activeCount} Currently Out</span>
            <span className="badge badge-overdue">{overdueCount} Overdue</span>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div className={`alert-banner ${notification.type === "error" ? "alert-error" : "alert-success"}`}>
            <span>{notification.type === "error" ? "⚠" : "✓"} {notification.message}</span>
            <button className="alert-close" onClick={() => setNotification(null)}>✕</button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="search-filter-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by patron, email, or book title..."
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Records ({borrowings.length})</option>
              <option value="borrowed">Active Borrowings</option>
              <option value="returned">Returned Books</option>
              <option value="overdue">Overdue Records</option>
            </select>
          </div>
        </div>

        {/* Circulation Table */}
        {loading ? (
          <LoadingSpinner message="Loading circulation history..." />
        ) : filteredBorrowings.length === 0 ? (
          <EmptyState
            icon="🔄"
            title="No circulation records found"
            description="No borrowings matched the current search or status filter."
          />
        ) : (
          <div className="borrowings-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patron</th>
                  <th>Book</th>
                  <th>Borrowed On</th>
                  <th>Due Date</th>
                  <th>Returned On</th>
                  <th>Status</th>
                  <th>Late Fee</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBorrowings.map((b) => {
                  const isReturned = b.returned_at !== null;
                  const isOverdue = !isReturned && new Date(b.due_date) < new Date();
                  const borrowedDate = new Date(b.borrowed_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const dueDate = new Date(b.due_date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const returnedDate = b.returned_at
                    ? new Date(b.returned_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr key={b.id} className={isOverdue ? "row-overdue" : ""}>
                      <td className="user-cell">
                        <div className="avatar-sm">
                          {(b.profiles?.name || b.profiles?.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{b.profiles?.name || "Member"}</strong>
                          <span className="table-subtext">{b.profiles?.email}</span>
                        </div>
                      </td>

                      <td className="book-cell">
                        <img
                          src={b.books?.image_url || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=100&q=80"}
                          alt={b.books?.title}
                          className="table-book-thumb"
                          onError={(e) => {
                            e.target.src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=100&q=80";
                          }}
                        />
                        <div>
                          <strong>{b.books?.title}</strong>
                          <span className="table-subtext">by {b.books?.author}</span>
                        </div>
                      </td>

                      <td>{borrowedDate}</td>

                      <td>
                        <span className={isOverdue ? "text-danger font-bold" : ""}>
                          {dueDate}
                          {isOverdue && <span className="overdue-tag">OVERDUE</span>}
                        </span>
                      </td>

                      <td>{returnedDate}</td>

                      <td>
                        <StatusBadge
                          status={isReturned ? "returned" : isOverdue ? "overdue" : "borrowed"}
                        />
                      </td>

                      <td>
                        {b.fine > 0 ? (
                          <span className="text-danger font-bold">₹{b.fine}</span>
                        ) : (
                          <span className="text-muted">₹0</span>
                        )}
                      </td>

                      <td>
                        {!isReturned ? (
                          <button
                            type="button"
                            className="btn-outline-sm"
                            onClick={() => setReturnDialog({ isOpen: true, item: b })}
                            disabled={returningId === b.id}
                          >
                            {returningId === b.id ? "Processing..." : "Process Return"}
                          </button>
                        ) : (
                          <span className="completed-check">✓ Checked in</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Admin Return Confirmation Dialog */}
        <ConfirmDialog
          isOpen={returnDialog.isOpen}
          title="Process Book Check-In"
          message={
            returnDialog.item
              ? `Check in "${returnDialog.item.books?.title}" for member "${
                  returnDialog.item.profiles?.name || returnDialog.item.profiles?.email
                }"? ${
                  new Date(returnDialog.item.due_date) < new Date()
                    ? "This book is overdue; late fee of ₹5/day will be saved."
                    : ""
                }`
              : ""
          }
          confirmText="Confirm Check-In"
          isLoading={returningId !== null}
          onConfirm={handleAdminReturn}
          onCancel={() => setReturnDialog({ isOpen: false, item: null })}
        />
      </div>
    </Layout>
  );
}
