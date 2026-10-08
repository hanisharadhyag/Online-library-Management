import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import Layout from "../components/Layout";
import BookCard from "../components/BookCard";
import BookModal from "../components/BookModal";
import SearchBar from "../components/SearchBar";
import LoadingSpinner from "../components/LoadingSpinner";
import EmptyState from "../components/EmptyState";

export default function Books() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [books, setBooks] = useState([]);
  const [userActiveBorrowings, setUserActiveBorrowings] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sortBy, setSortBy] = useState("title_asc");

  // Modal & Actions
  const [selectedBook, setSelectedBook] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [borrowingId, setBorrowingId] = useState(null);
  const [notification, setNotification] = useState(null);

  const fetchBooksAndBorrowings = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch all books
      const { data: booksData, error: booksErr } = await supabase
        .from("books")
        .select("*")
        .order("title", { ascending: true });

      if (booksErr) throw booksErr;
      setBooks(booksData || []);

      // Fetch user's active borrowings to prevent duplicate borrowing
      if (user) {
        const { data: activeData, error: activeErr } = await supabase
          .from("borrowings")
          .select("book_id")
          .eq("user_id", user.id)
          .is("returned_at", null);

        if (!activeErr && activeData) {
          setUserActiveBorrowings(new Set(activeData.map((b) => b.book_id)));
        }
      }
    } catch (err) {
      console.error("Error fetching books:", err);
      setError("Unable to load books catalog. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBooksAndBorrowings();
  }, [fetchBooksAndBorrowings]);

  // Derive categories list
  const categories = useMemo(() => {
    const set = new Set();
    books.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set).sort();
  }, [books]);

  // Filtered & Sorted books
  const filteredBooks = useMemo(() => {
    return books
      .filter((book) => {
        // Query search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = book.title?.toLowerCase().includes(q);
          const matchAuthor = book.author?.toLowerCase().includes(q);
          const matchIsbn = book.isbn?.toLowerCase().includes(q);
          if (!matchTitle && !matchAuthor && !matchIsbn) return false;
        }

        // Category filter
        if (selectedCategory !== "All" && book.category !== selectedCategory) {
          return false;
        }

        // Only available
        if (onlyAvailable && book.available_copies <= 0) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "title_asc") return a.title.localeCompare(b.title);
        if (sortBy === "title_desc") return b.title.localeCompare(a.title);
        if (sortBy === "available_desc") return b.available_copies - a.available_copies;
        if (sortBy === "newest") return new Date(b.created_at) - new Date(a.created_at);
        return 0;
      });
  }, [books, searchQuery, selectedCategory, onlyAvailable, sortBy]);

  const handleBorrow = async (book) => {
    if (!user) {
      setNotification({ type: "error", message: "Please log in to borrow books." });
      return;
    }

    if (userActiveBorrowings.has(book.id)) {
      setNotification({ type: "error", message: "You already have an active borrowing for this book." });
      return;
    }

    if (book.available_copies <= 0) {
      setNotification({ type: "error", message: "This book is currently out of stock." });
      return;
    }

    try {
      setBorrowingId(book.id);
      const { error: rpcErr } = await supabase.rpc("borrow_book", {
        p_book_id: book.id,
      });

      if (rpcErr) throw rpcErr;

      setNotification({
        type: "success",
        message: `Successfully borrowed "${book.title}"! Due date: 14 days from today.`,
      });

      // Update local state immediately
      setBooks((prev) =>
        prev.map((b) =>
          b.id === book.id
            ? { ...b, available_copies: Math.max(0, b.available_copies - 1) }
            : b
        )
      );
      setUserActiveBorrowings((prev) => new Set([...prev, book.id]));

      // Close modal if open
      if (isModalOpen && selectedBook?.id === book.id) {
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error("Borrow error:", err);
      setNotification({
        type: "error",
        message: err.message || "Failed to borrow book. Please try again.",
      });
    } finally {
      setBorrowingId(null);
    }
  };

  const handleOpenDetails = (book) => {
    setSelectedBook(book);
    setIsModalOpen(true);
  };

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Library Catalog</h1>
            <p>Explore titles, inspect availability, and borrow books instantly.</p>
          </div>
          <div className="catalog-count-badge">
            <strong>{filteredBooks.length}</strong> of {books.length} titles
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div className={`alert-banner ${notification.type === "error" ? "alert-error" : "alert-success"}`}>
            <span>{notification.type === "error" ? "⚠" : "✓"} {notification.message}</span>
            <button className="alert-close" onClick={() => setNotification(null)}>✕</button>
          </div>
        )}

        {/* Search & Filters */}
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categories={categories}
          onlyAvailable={onlyAvailable}
          onOnlyAvailableChange={setOnlyAvailable}
          sortBy={sortBy}
          onSortByChange={setSortBy}
        />

        {/* Content */}
        {loading ? (
          <LoadingSpinner message="Loading catalog..." />
        ) : error ? (
          <div className="error-card">
            <span className="error-icon">⚠️</span>
            <h3>Error Loading Books</h3>
            <p>{error}</p>
            <button className="btn-primary-sm mt-3" onClick={fetchBooksAndBorrowings}>
              Retry
            </button>
          </div>
        ) : filteredBooks.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No books match your criteria"
            description="Try modifying your search term, clearing category filters, or toggling availability."
            actionText="Reset Filters"
            onAction={() => {
              setSearchQuery("");
              setSelectedCategory("All");
              setOnlyAvailable(false);
              setSortBy("title_asc");
            }}
          />
        ) : (
          <div className="books-grid">
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onViewDetails={handleOpenDetails}
                onBorrow={handleBorrow}
                isBorrowing={borrowingId === book.id}
                userHasBorrowed={userActiveBorrowings.has(book.id)}
              />
            ))}
          </div>
        )}

        {/* Book Details Modal */}
        <BookModal
          book={selectedBook}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedBook(null);
          }}
          onBorrow={handleBorrow}
          isBorrowing={borrowingId === selectedBook?.id}
          userHasBorrowed={selectedBook ? userActiveBorrowings.has(selectedBook.id) : false}
        />
      </div>
    </Layout>
  );
}