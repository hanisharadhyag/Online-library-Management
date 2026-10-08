import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import Layout from "../../components/Layout";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";

const INITIAL_FORM = {
  title: "",
  author: "",
  isbn: "",
  category: "Technology",
  description: "",
  total_copies: 1,
  available_copies: 1,
  image_url: "",
};

export default function AdminBooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, book: null });
  const [deleting, setDeleting] = useState(false);

  // Alert message
  const [notification, setNotification] = useState(null);

  const fetchBooks = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("title", { ascending: true });

      if (error) throw error;
      setBooks(data || []);
    } catch (err) {
      console.error("Error fetching books:", err);
      setNotification({ type: "error", message: "Failed to load books catalog." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const categories = useMemo(() => {
    const set = new Set(["Technology", "Programming", "Business", "Self-help", "Science", "Fiction"]);
    books.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set).sort();
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mTitle = b.title?.toLowerCase().includes(q);
        const mAuthor = b.author?.toLowerCase().includes(q);
        const mIsbn = b.isbn?.toLowerCase().includes(q);
        if (!mTitle && !mAuthor && !mIsbn) return false;
      }
      if (selectedCategory !== "All" && b.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [books, searchQuery, selectedCategory]);

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (book) => {
    setIsEditing(true);
    setEditingId(book.id);
    setFormData({
      title: book.title || "",
      author: book.author || "",
      isbn: book.isbn || "",
      category: book.category || "Technology",
      description: book.description || "",
      total_copies: book.total_copies ?? 1,
      available_copies: book.available_copies ?? 1,
      image_url: book.image_url || "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type } = e.target;
    let parsedValue = value;

    if (type === "number") {
      parsedValue = Math.max(0, parseInt(value, 10) || 0);
    }

    setFormData((prev) => {
      const updated = { ...prev, [name]: parsedValue };
      // Maintain available_copies <= total_copies
      if (name === "total_copies") {
        if (updated.available_copies > parsedValue) {
          updated.available_copies = parsedValue;
        }
      }
      if (name === "available_copies") {
        if (parsedValue > updated.total_copies) {
          updated.total_copies = parsedValue;
        }
      }
      return updated;
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formData.title.trim() || !formData.author.trim()) {
      setFormError("Title and Author are required fields.");
      return;
    }

    if (formData.total_copies < 0 || formData.available_copies < 0) {
      setFormError("Copy quantities cannot be negative.");
      return;
    }

    if (formData.available_copies > formData.total_copies) {
      setFormError("Available copies cannot exceed total copies.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: formData.title.trim(),
        author: formData.author.trim(),
        isbn: formData.isbn.trim() || null,
        category: formData.category.trim() || "General",
        description: formData.description.trim(),
        total_copies: Number(formData.total_copies),
        available_copies: Number(formData.available_copies),
        image_url:
          formData.image_url.trim() ||
          "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80",
      };

      if (isEditing) {
        const { error } = await supabase
          .from("books")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
        setNotification({ type: "success", message: `Updated "${payload.title}" successfully.` });
      } else {
        const { error } = await supabase.from("books").insert([payload]);
        if (error) throw error;
        setNotification({ type: "success", message: `Added "${payload.title}" to catalog.` });
      }

      setIsModalOpen(false);
      await fetchBooks();
    } catch (err) {
      console.error("Save book error:", err);
      setFormError(err.message || "Failed to save book. Verify ISBN uniqueness.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.book) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from("books")
        .delete()
        .eq("id", deleteDialog.book.id);

      if (error) throw error;

      setNotification({
        type: "success",
        message: `Book "${deleteDialog.book.title}" was removed from the catalog.`,
      });
      setDeleteDialog({ isOpen: false, book: null });
      await fetchBooks();
    } catch (err) {
      console.error("Delete book error:", err);
      setNotification({
        type: "error",
        message: err.message || "Failed to delete book. It may have active borrowings.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Book Inventory Management</h1>
            <p>Add new titles, update copy counts, edit book details, and manage inventory.</p>
          </div>
          <button type="button" className="btn-primary" onClick={handleOpenAdd}>
            + Add New Book
          </button>
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
              placeholder="Search by title, author, or ISBN..."
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
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Books Table */}
        {loading ? (
          <LoadingSpinner message="Loading catalog inventory..." />
        ) : filteredBooks.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No books found"
            description="No books match your search or category criteria."
            actionText="Add Book Now"
            onAction={handleOpenAdd}
          />
        ) : (
          <div className="borrowings-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Category</th>
                  <th>ISBN</th>
                  <th>Total Copies</th>
                  <th>Available</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((b) => {
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
                        </div>
                      </td>

                      <td>
                        <span className="badge badge-category">{b.category || "General"}</span>
                      </td>

                      <td>
                        <span className="font-mono text-xs">{b.isbn || "—"}</span>
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
                        <StatusBadge
                          status={!isAvailable ? "out_of_stock" : isLowStock ? "low_stock" : "available"}
                          label={!isAvailable ? "Out of Stock" : isLowStock ? "1 Copy Left" : "In Stock"}
                        />
                      </td>

                      <td>
                        <div className="table-action-group">
                          <button
                            type="button"
                            className="btn-outline-sm"
                            onClick={() => handleOpenEdit(b)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-danger-sm"
                            onClick={() => setDeleteDialog({ isOpen: true, book: b })}
                          >
                            Delete
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

        {/* Add/Edit Modal */}
        {isModalOpen && (
          <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
            <div className="modal-dialog-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{isEditing ? "Edit Book Details" : "Add New Book to Library"}</h3>
                <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                  ✕
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="modal-body-form">
                {formError && <div className="login-error">⚠ {formError}</div>}

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Title *</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleFormChange}
                      placeholder="e.g. Clean Architecture"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Author *</label>
                    <input
                      type="text"
                      name="author"
                      value={formData.author}
                      onChange={handleFormChange}
                      placeholder="e.g. Robert C. Martin"
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>ISBN</label>
                    <input
                      type="text"
                      name="isbn"
                      value={formData.isbn}
                      onChange={handleFormChange}
                      placeholder="e.g. 978-0134494166"
                    />
                  </div>

                  <div className="input-group">
                    <label>Category *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleFormChange}
                      className="select-control full-width"
                      required
                    >
                      <option value="Technology">Technology</option>
                      <option value="Programming">Programming</option>
                      <option value="Business">Business</option>
                      <option value="Self-help">Self-help</option>
                      <option value="Science">Science</option>
                      <option value="Fiction">Fiction</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="input-group">
                    <label>Total Copies *</label>
                    <input
                      type="number"
                      name="total_copies"
                      min="0"
                      value={formData.total_copies}
                      onChange={handleFormChange}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Available Copies *</label>
                    <input
                      type="number"
                      name="available_copies"
                      min="0"
                      max={formData.total_copies}
                      value={formData.available_copies}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Cover Image URL</label>
                  <input
                    type="url"
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleFormChange}
                    placeholder="https://images.unsplash.com/..."
                  />
                  <small className="input-hint">Provide an image URL or leave blank for a default cover.</small>
                </div>

                <div className="input-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    rows="3"
                    className="textarea-control"
                    value={formData.description}
                    onChange={handleFormChange}
                    placeholder="Brief synopsis or overview of this book..."
                  />
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? "Saving..." : isEditing ? "Save Changes" : "Add Book"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={deleteDialog.isOpen}
          title="Delete Book"
          message={`Are you sure you want to delete "${deleteDialog.book?.title}"? This will permanently remove it from the catalog.`}
          confirmText="Yes, Delete"
          isDanger={true}
          isLoading={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteDialog({ isOpen: false, book: null })}
        />
      </div>
    </Layout>
  );
}
