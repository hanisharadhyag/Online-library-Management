import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import Layout from "../../components/Layout";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";

export default function AdminInventory() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [notification, setNotification] = useState(null);

  const fetchInventory = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("available_copies", { ascending: true });

      if (error) throw error;
      setBooks(data || []);
    } catch (err) {
      console.error("Error fetching inventory:", err);
      setNotification({ type: "error", message: "Failed to load inventory." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mTitle = b.title?.toLowerCase().includes(q);
        const mAuthor = b.author?.toLowerCase().includes(q);
        const mIsbn = b.isbn?.toLowerCase().includes(q);
        if (!mTitle && !mAuthor && !mIsbn) return false;
      }

      if (stockFilter === "low" && b.available_copies !== 1) return false;
      if (stockFilter === "out" && b.available_copies > 0) return false;
      if (stockFilter === "healthy" && b.available_copies <= 1) return false;

      return true;
    });
  }, [books, searchQuery, stockFilter]);

  // Adjust physical stock copies
  const handleQuickAdjustCopies = async (book, delta) => {
    const newTotal = Math.max(0, book.total_copies + delta);
    const borrowed = Math.max(0, book.total_copies - book.available_copies);
    const newAvailable = Math.max(0, newTotal - borrowed);

    if (newTotal < borrowed) {
      setNotification({
        type: "error",
        message: `Cannot decrease total copies below currently borrowed count (${borrowed}).`,
      });
      return;
    }

    try {
      setUpdatingId(book.id);
      const { error } = await supabase
        .from("books")
        .update({
          total_copies: newTotal,
          available_copies: newAvailable,
        })
        .eq("id", book.id);

      if (error) throw error;

      setNotification({
        type: "success",
        message: `Updated copies for "${book.title}" to ${newTotal} total (${newAvailable} available).`,
      });
      await fetchInventory();
    } catch (err) {
      console.error("Stock adjustment error:", err);
      setNotification({ type: "error", message: err.message || "Failed to adjust stock." });
    } finally {
      setUpdatingId(null);
    }
  };

  const totalCopiesSum = books.reduce((acc, b) => acc + (b.total_copies || 0), 0);
  const availableCopiesSum = books.reduce((acc, b) => acc + (b.available_copies || 0), 0);
  const borrowedCopiesSum = Math.max(0, totalCopiesSum - availableCopiesSum);
  const outOfStockCount = books.filter((b) => b.available_copies === 0).length;
  const lowStockCount = books.filter((b) => b.available_copies === 1).length;

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Inventory & Stock Health</h1>
            <p>Track book circulation capacity, identify low-inventory titles, and adjust quantities.</p>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div className={`alert-banner ${notification.type === "error" ? "alert-error" : "alert-success"}`}>
            <span>{notification.type === "error" ? "⚠" : "✓"} {notification.message}</span>
            <button className="alert-close" onClick={() => setNotification(null)}>✕</button>
          </div>
        )}

        {/* Stock Alert Banners */}
        {outOfStockCount > 0 && (
          <div className="alert-banner alert-danger">
            <span className="alert-icon">🚫</span>
            <div className="alert-text">
              <strong>{outOfStockCount} title(s) are completely out of stock!</strong>
              <p>Borrowers cannot check out these titles until copies are returned or procured.</p>
            </div>
          </div>
        )}

        {lowStockCount > 0 && (
          <div className="alert-banner alert-warning">
            <span className="alert-icon">⚠️</span>
            <div className="alert-text">
              <strong>{lowStockCount} title(s) have low stock (only 1 copy remaining).</strong>
              <p>Monitor circulation to ensure availability for active patrons.</p>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="stats-grid">
          <StatCard
            title="Total Stock Copies"
            value={totalCopiesSum}
            icon="🏷️"
            subtitle="Overall inventory size"
            color="indigo"
          />
          <StatCard
            title="Available on Shelf"
            value={availableCopiesSum}
            icon="✓"
            subtitle="Ready to be borrowed"
            color="emerald"
          />
          <StatCard
            title="Currently In Circulation"
            value={borrowedCopiesSum}
            icon="📖"
            subtitle="In hands of members"
            color="purple"
          />
          <StatCard
            title="Out of Stock"
            value={outOfStockCount}
            icon="🚫"
            subtitle="0 copies available"
            color={outOfStockCount > 0 ? "rose" : "emerald"}
          />
        </div>

        {/* Search & Filter Bar */}
        <div className="search-filter-bar mt-4">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search inventory by title, author, or ISBN..."
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
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="all">All Titles ({books.length})</option>
              <option value="out">Out of Stock ({outOfStockCount})</option>
              <option value="low">Low Inventory ({lowStockCount})</option>
              <option value="healthy">Healthy Stock</option>
            </select>
          </div>
        </div>

        {/* Inventory Table */}
        {loading ? (
          <LoadingSpinner message="Evaluating inventory metrics..." />
        ) : filteredBooks.length === 0 ? (
          <EmptyState
            icon="📦"
            title="No inventory records found"
            description="No titles match the chosen search or stock criteria."
          />
        ) : (
          <div className="borrowings-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Total Copies</th>
                  <th>Available</th>
                  <th>Borrowed</th>
                  <th>Circulation Health</th>
                  <th>Stock Status</th>
                  <th>Quick Procure</th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((b) => {
                  const borrowed = Math.max(0, b.total_copies - b.available_copies);
                  const utilPercent =
                    b.total_copies > 0 ? Math.round((borrowed / b.total_copies) * 100) : 0;
                  const isAvailable = b.available_copies > 0;
                  const isLowStock = b.available_copies === 1;

                  return (
                    <tr key={b.id}>
                      <td className="book-cell">
                        <img
                          src={b.image_url || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=100&q=80"}
                          alt={b.title}
                          className="table-book-thumb"
                          onError={(e) => {
                            e.target.src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=100&q=80";
                          }}
                        />
                        <div>
                          <strong>{b.title}</strong>
                          <span className="table-subtext">by {b.author}</span>
                          <span className="badge badge-category mt-1">{b.category || "General"}</span>
                        </div>
                      </td>

                      <td>
                        <strong>{b.total_copies}</strong>
                      </td>

                      <td>
                        <strong className={b.available_copies === 0 ? "text-danger" : "text-emerald"}>
                          {b.available_copies}
                        </strong>
                      </td>

                      <td>
                        <strong>{borrowed}</strong>
                      </td>

                      <td>
                        <div className="utilization-bar-wrapper">
                          <div className="utilization-progress">
                            <div
                              className="utilization-fill"
                              style={{
                                width: `${utilPercent}%`,
                                backgroundColor:
                                  utilPercent > 80
                                    ? "#ef4444"
                                    : utilPercent > 50
                                    ? "#f59e0b"
                                    : "#4f46e5",
                              }}
                            />
                          </div>
                          <span className="utilization-text">{utilPercent}% Out</span>
                        </div>
                      </td>

                      <td>
                        <StatusBadge
                          status={!isAvailable ? "out_of_stock" : isLowStock ? "low_stock" : "available"}
                          label={
                            !isAvailable
                              ? "Out of Stock"
                              : isLowStock
                              ? "Low Stock (1 left)"
                              : "In Stock"
                          }
                        />
                      </td>

                      <td>
                        <div className="quantity-counter">
                          <button
                            type="button"
                            className="counter-btn"
                            onClick={() => handleQuickAdjustCopies(b, -1)}
                            disabled={updatingId === b.id || b.total_copies <= borrowed}
                            title="Remove a copy"
                          >
                            –
                          </button>
                          <span className="counter-val">{b.total_copies}</span>
                          <button
                            type="button"
                            className="counter-btn"
                            onClick={() => handleQuickAdjustCopies(b, 1)}
                            disabled={updatingId === b.id}
                            title="Add a copy"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
