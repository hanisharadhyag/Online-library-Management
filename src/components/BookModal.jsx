import StatusBadge from "./StatusBadge";

export default function BookModal({
  book,
  isOpen,
  onClose,
  onBorrow,
  isBorrowing = false,
  userHasBorrowed = false,
}) {
  if (!isOpen || !book) return null;

  const isAvailable = book.available_copies > 0;
  const isLowStock = book.available_copies === 1;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="book-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        <div className="book-modal-grid">
          <div className="book-modal-cover-col">
            <img
              src={book.image_url || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80"}
              alt={book.title}
              className="book-modal-cover"
              onError={(e) => {
                e.target.src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80";
              }}
            />
            <div className="book-modal-badge-wrapper">
              <StatusBadge
                status={!isAvailable ? "out_of_stock" : isLowStock ? "low_stock" : "available"}
                label={!isAvailable ? "Out of Stock" : isLowStock ? "Only 1 Copy Left" : `${book.available_copies} Copies Available`}
              />
            </div>
          </div>

          <div className="book-modal-info-col">
            <div className="book-modal-header">
              <span className="badge badge-category">{book.category || "General"}</span>
              <h2 className="book-modal-title">{book.title}</h2>
              <p className="book-modal-author">by <strong>{book.author}</strong></p>
            </div>

            <div className="book-modal-metadata">
              <div className="meta-item">
                <span className="meta-label">ISBN</span>
                <span className="meta-value">{book.isbn || "N/A"}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Total Inventory</span>
                <span className="meta-value">{book.total_copies} copies</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Available</span>
                <span className="meta-value">{book.available_copies} copies</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Loan Duration</span>
                <span className="meta-value">14 Days</span>
              </div>
            </div>

            <div className="book-modal-description">
              <h4>About this book</h4>
              <p>{book.description || "No description provided for this title."}</p>
            </div>

            <div className="book-modal-notice">
              <span className="notice-icon">ℹ</span>
              <div>
                <strong>Borrowing Terms</strong>
                <p>Return within 14 days to avoid overdue charges (₹5 per overdue day).</p>
              </div>
            </div>

            <div className="book-modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Close
              </button>

              {userHasBorrowed ? (
                <button type="button" className="btn-secondary" disabled>
                  ✓ Currently In Your Borrowings
                </button>
              ) : isAvailable ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onBorrow(book)}
                  disabled={isBorrowing}
                >
                  {isBorrowing ? "Processing Borrow..." : "Borrow This Book"}
                </button>
              ) : (
                <button type="button" className="btn-disabled" disabled>
                  Currently Unavailable
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
