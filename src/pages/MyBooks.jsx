import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";

export default function MyBooks() {
  const { user } = useAuth();
  const [borrowings, setBorrowings] = useState([]);
  const [activeTab, setActiveTab] = useState("current");
  const [loading, setLoading] = useState(true);
  const [returningId, setReturningId] = useState(null);
  const [returnDialog, setReturnDialog] = useState({ isOpen: false, item: null });
  const [notification, setNotification] = useState(null);

  const fetchBorrowings = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Refresh overdue records (ignore errors — best effort)
      try { await supabase.rpc("refresh_overdue_borrowings"); } catch (_) {}

      const { data, error } = await supabase
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
            isbn,
            image_url
          )
        `)
        .eq("user_id", user.id)
        .order("borrowed_at", { ascending: false });

      if (error) throw error;
      setBorrowings(data || []);
    } catch (err) {
      console.error("Error loading borrowings — full error:", err);
      setNotification({
        type: "error",
        message: err?.message || err?.error_description || "Failed to load borrowings history. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBorrowings();
  }, [fetchBorrowings]);

  // Tab categorization
  const filteredBorrowings = useMemo(() => {
    const now = new Date();
    return borrowings.filter((item) => {
      const isReturned = item.returned_at !== null;
      const isOverdue = !isReturned && (new Date(item.due_date) < now || item.status === "overdue");

      if (activeTab === "current") return !isReturned;
      if (activeTab === "overdue") return isOverdue;
      if (activeTab === "returned") return isReturned;
      if (activeTab === "all") return true;
      return true;
    });
  }, [borrowings, activeTab]);

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
      setNotification({
        type: "success",
        message:
          fineAmount > 0
            ? `Book returned! An overdue fee of ₹${fineAmount} was applied.`
            : "Book returned successfully with no fines!",
      });

      setReturnDialog({ isOpen: false, item: null });
      await fetchBorrowings();
    } catch (err) {
      console.error("Return error:", err);
      setNotification({
        type: "error",
        message: err.message || "Failed to return book. Please try again.",
      });
    } finally {
      setReturningId(null);
    }
  };

  const currentCount = borrowings.filter((b) => !b.returned_at).length;
  const overdueCount = borrowings.filter((b) => !b.returned_at && new Date(b.due_date) < new Date()).length;
  const returnedCount = borrowings.filter((b) => b.returned_at).length;

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>My Books</h1>
            <p>Track all your borrowed books, due dates, fines, and return records.</p>
          </div>
          <Link to="/books" className="btn-primary">
            + Borrow More Books
          </Link>
        </div>

        {/* Notifications */}
        {notification && (
          <div className={`alert-banner ${notification.type === "error" ? "alert-error" : "alert-success"}`}>
            <span>{notification.type === "error" ? "⚠" : "✓"} {notification.message}</span>
            <button className="alert-close" onClick={() => setNotification(null)}>✕</button>
          </div>
        )}

        {/* Overdue Warning */}
        {overdueCount > 0 && (
          <div className="alert-banner alert-danger">
            <span className="alert-icon">⚠️</span>
            <div className="alert-text">
              <strong>You have {overdueCount} overdue item(s)!</strong>
              <p>Late returns incur ₹5 per day. Return them immediately to prevent further charges.</p>
            </div>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="tabs-container">
          <button
            type="button"
            className={`tab-btn ${activeTab === "current" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("current")}
          >
            Currently Borrowed ({currentCount})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "overdue" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("overdue")}
          >
            Overdue ({overdueCount})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "returned" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("returned")}
          >
            Returned ({returnedCount})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "all" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All History ({borrowings.length})
          </button>
        </div>

        {/* Borrowings List */}
        {loading ? (
          <LoadingSpinner message="Loading your borrowing history..." />
        ) : filteredBorrowings.length === 0 ? (
          <EmptyState
            icon="📚"
            title={`No ${activeTab === "current" ? "currently borrowed" : activeTab} books`}
            description={
              activeTab === "current"
                ? "You don't have any books borrowed right now. Browse our catalog to get started!"
                : "No records found under this section."
            }
            actionText={activeTab === "current" ? "Browse Books" : undefined}
            onAction={activeTab === "current" ? () => (window.location.href = "/books") : undefined}
          />
        ) : (
          <div className="borrowings-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Category</th>
                  <th>Borrowed On</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Late Fine</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBorrowings.map((item) => {
                  const isReturned = item.returned_at !== null;
                  const isOverdue = !isReturned && new Date(item.due_date) < new Date();
                  const borrowedDate = new Date(item.borrowed_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const dueDate = new Date(item.due_date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const returnedDate = item.returned_at
                    ? new Date(item.returned_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null;

                  return (
                    <tr key={item.id} className={isOverdue ? "row-overdue" : ""}>
                      <td className="book-cell">
                        <img
                          src={item.books?.image_url || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=100&q=80"}
                          alt={item.books?.title}
                          className="table-book-thumb"
                          onError={(e) => {
                            e.target.src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=100&q=80";
                          }}
                        />
                        <div>
                          <strong>{item.books?.title}</strong>
                          <span className="table-subtext">by {item.books?.author}</span>
                          {item.books?.isbn && (
                            <span className="table-isbn">ISBN: {item.books?.isbn}</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className="badge badge-category">
                          {item.books?.category || "General"}
                        </span>
                      </td>

                      <td>{borrowedDate}</td>

                      <td>
                        <div className={isOverdue ? "text-danger font-bold" : ""}>
                          {dueDate}
                          {isOverdue && <span className="overdue-tag">LATE</span>}
                        </div>
                      </td>

                      <td>
                        <StatusBadge
                          status={isReturned ? "returned" : isOverdue ? "overdue" : "borrowed"}
                          label={
                            isReturned
                              ? `Returned on ${returnedDate}`
                              : isOverdue
                              ? "Overdue"
                              : "Active Borrow"
                          }
                        />
                      </td>

                      <td>
                        {item.fine > 0 ? (
                          <span className="text-danger font-bold">₹{item.fine}</span>
                        ) : (
                          <span className="text-muted">₹0</span>
                        )}
                      </td>

                      <td>
                        {!isReturned ? (
                          <button
                            type="button"
                            className="btn-outline-sm"
                            onClick={() => setReturnDialog({ isOpen: true, item })}
                            disabled={returningId === item.id}
                          >
                            {returningId === item.id ? "Returning..." : "Return Book"}
                          </button>
                        ) : (
                          <span className="completed-check">✓ Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Return Confirmation Dialog */}
        <ConfirmDialog
          isOpen={returnDialog.isOpen}
          title="Return Book to Library"
          message={
            returnDialog.item
              ? `Are you sure you want to return "${returnDialog.item.books?.title}"? ${
                  new Date(returnDialog.item.due_date) < new Date()
                    ? "Warning: This book is past its due date. An overdue fee of ₹5 per day will be calculated."
                    : "This return is on time. Thank you!"
                }`
              : ""
          }
          confirmText="Confirm Return"
          isLoading={returningId !== null}
          onConfirm={handleReturnConfirm}
          onCancel={() => setReturnDialog({ isOpen: false, item: null })}
        />
      </div>
    </Layout>
  );
}