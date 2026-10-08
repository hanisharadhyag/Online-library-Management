import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import Layout from "../../components/Layout";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalCopies: 0,
    availableCopies: 0,
    borrowedCopies: 0,
    overdueBooks: 0,
    registeredMembers: 0,
    totalFines: 0,
  });

  const [recentBorrowings, setRecentBorrowings] = useState([]);
  const [lowStockBooks, setLowStockBooks] = useState([]);
  const [popularBooks, setPopularBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminStats = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Trigger automatic overdue check (best effort)
      try { await supabase.rpc("refresh_overdue_borrowings"); } catch (_) {}

      // 1. Fetch Books
      const { data: books, error: booksErr } = await supabase
        .from("books")
        .select("*");
      if (booksErr) throw booksErr;

      const booksList = books || [];
      let totalCopiesCount = 0;
      let availableCopiesCount = 0;
      const lowStock = [];

      booksList.forEach((b) => {
        totalCopiesCount += Number(b.total_copies || 0);
        availableCopiesCount += Number(b.available_copies || 0);
        if (b.available_copies <= 1) {
          lowStock.push(b);
        }
      });

      // 2. Fetch Borrowings
      const { data: borrowings, error: bErr } = await supabase
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
          books ( title, author, image_url )
        `)
        .order("borrowed_at", { ascending: false });
      if (bErr) throw bErr;

      const bList = borrowings || [];
      let borrowedCount = 0;
      let overdueCount = 0;
      let totalFinesSum = 0;
      const bookBorrowFrequency = {};

      bList.forEach((b) => {
        totalFinesSum += Number(b.fine || 0);
        if (!b.returned_at) {
          borrowedCount++;
          if (new Date(b.due_date) < new Date() || b.status === "overdue") {
            overdueCount++;
          }
        }
        // Count popularity
        if (b.book_id) {
          bookBorrowFrequency[b.book_id] = (bookBorrowFrequency[b.book_id] || 0) + 1;
        }
      });

      // Rank popular books
      const pop = booksList
        .map((b) => ({ ...b, borrowCount: bookBorrowFrequency[b.id] || 0 }))
        .sort((a, b) => b.borrowCount - a.borrowCount)
        .slice(0, 5);

      // 3. Fetch Members Count
      const { count: membersCount, error: mErr } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (mErr) console.warn("Members count error:", mErr);

      setStats({
        totalBooks: booksList.length,
        totalCopies: totalCopiesCount,
        availableCopies: availableCopiesCount,
        borrowedCopies: borrowedCount,
        overdueBooks: overdueCount,
        registeredMembers: membersCount || 0,
        totalFines: totalFinesSum,
      });

      setRecentBorrowings(bList.slice(0, 6));
      setLowStockBooks(lowStock.slice(0, 5));
      setPopularBooks(pop);
    } catch (err) {
      console.error("Error loading admin dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminStats();
  }, [fetchAdminStats]);

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Admin Command Center</h1>
            <p>Real-time analytics, inventory monitoring, borrowing velocity, and library health.</p>
          </div>
          <div className="header-actions">
            <Link to="/admin/books" className="btn-primary">
              + Add New Book
            </Link>
          </div>
        </div>

        {/* Overdue Alert if any */}
        {stats.overdueBooks > 0 && (
          <div className="alert-banner alert-danger">
            <span className="alert-icon">⚠️</span>
            <div className="alert-text">
              <strong>Attention: {stats.overdueBooks} book borrowing(s) are currently overdue!</strong>
              <p>Review the Overdue management view to check member records and follow up.</p>
            </div>
            <Link to="/admin/overdue" className="btn-danger-sm">
              Review Overdue Records
            </Link>
          </div>
        )}

        {/* Low Stock Alert if any */}
        {lowStockBooks.length > 0 && (
          <div className="alert-banner alert-warning">
            <span className="alert-icon">📦</span>
            <div className="alert-text">
              <strong>Inventory Warning: {lowStockBooks.length} title(s) have 1 or 0 copies remaining.</strong>
              <p>Consider procuring additional copies to satisfy member demand.</p>
            </div>
            <Link to="/admin/inventory" className="btn-outline-sm">
              Check Inventory
            </Link>
          </div>
        )}

        {/* 7 Core Analytics Metrics */}
        <div className="admin-stats-grid">
          <StatCard
            title="Total Unique Titles"
            value={stats.totalBooks}
            icon="📚"
            subtitle="Catalog diversity"
            color="indigo"
          />
          <StatCard
            title="Total Physical Copies"
            value={stats.totalCopies}
            icon="🏷️"
            subtitle="Complete inventory"
            color="purple"
          />
          <StatCard
            title="Available in Library"
            value={stats.availableCopies}
            icon="✓"
            subtitle="On shelf right now"
            color="emerald"
          />
          <StatCard
            title="Currently Borrowed"
            value={stats.borrowedCopies}
            icon="📖"
            subtitle="In circulation"
            color="amber"
          />
          <StatCard
            title="Overdue Books"
            value={stats.overdueBooks}
            icon="⚠️"
            subtitle="Past return deadline"
            color="rose"
          />
          <StatCard
            title="Registered Members"
            value={stats.registeredMembers}
            icon="👥"
            subtitle="Active library patrons"
            color="indigo"
          />
          <StatCard
            title="Total Fines Accrued"
            value={`₹${stats.totalFines}`}
            icon="💰"
            subtitle="Calculated at ₹5/day"
            color={stats.totalFines > 0 ? "rose" : "emerald"}
          />
        </div>

        {/* Two Column Grid: Recent Activity & Popular Books */}
        <div className="admin-two-col mt-4">
          {/* Recent Borrowings Activity */}
          <div className="admin-card">
            <div className="card-header-flex">
              <div>
                <h3>Recent Circulation Activity</h3>
                <p>Latest borrowings and check-ins</p>
              </div>
              <Link to="/admin/borrowings" className="btn-link">
                View All →
              </Link>
            </div>

            {loading ? (
              <LoadingSpinner message="Loading circulation..." />
            ) : recentBorrowings.length === 0 ? (
              <p className="text-muted p-4">No borrowing transactions recorded yet.</p>
            ) : (
              <div className="recent-list">
                {recentBorrowings.map((b) => {
                  const isReturned = b.returned_at !== null;
                  const isOverdue = !isReturned && new Date(b.due_date) < new Date();
                  const memberName = b.profiles?.name || b.profiles?.email || "Member";

                  return (
                    <div key={b.id} className="recent-item">
                      <img
                        src={b.books?.image_url || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=100&q=80"}
                        alt={b.books?.title}
                        className="recent-book-thumb"
                        onError={(e) => {
                          e.target.src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=100&q=80";
                        }}
                      />
                      <div className="recent-info">
                        <strong>{b.books?.title}</strong>
                        <span className="recent-patron">Patron: {memberName}</span>
                        <span className="recent-date">
                          Due: {new Date(b.due_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="recent-badge">
                        <StatusBadge
                          status={isReturned ? "returned" : isOverdue ? "overdue" : "borrowed"}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Popular Books & Inventory Alerts */}
          <div className="admin-card">
            <div className="card-header-flex">
              <div>
                <h3>Popular Books</h3>
                <p>Most borrowed titles in the library</p>
              </div>
              <Link to="/admin/books" className="btn-link">
                Manage Books →
              </Link>
            </div>

            {loading ? (
              <LoadingSpinner message="Calculating popularity..." />
            ) : popularBooks.length === 0 ? (
              <p className="text-muted p-4">No books data available.</p>
            ) : (
              <div className="popular-list">
                {popularBooks.map((book, idx) => (
                  <div key={book.id} className="popular-item">
                    <span className="popular-rank">#{idx + 1}</span>
                    <img
                      src={book.image_url || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=100&q=80"}
                      alt={book.title}
                      className="popular-thumb"
                      onError={(e) => {
                        e.target.src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=100&q=80";
                      }}
                    />
                    <div className="popular-info">
                      <strong>{book.title}</strong>
                      <span className="popular-author">by {book.author}</span>
                      <span className="popular-copies">
                        Stock: {book.available_copies} / {book.total_copies}
                      </span>
                    </div>
                    <div className="popular-count-pill">
                      <strong>{book.borrowCount}</strong> borrows
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
