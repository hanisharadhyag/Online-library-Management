import StatusBadge from "./StatusBadge";

export default function BookCard({
  book,
  onViewDetails,
  onBorrow,
  isBorrowing = false,
  userHasBorrowed = false,
}) {
  const isAvailable = book.available_copies > 0;
  const isLowStock = book.available_copies === 1;

  return (
    <div className="book-card">
      <div className="book-card-cover-wrapper" onClick={() => onViewDetails(book)}>
        <img
          src={book.image_url || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=400&q=80"}
          alt={book.title}
          className="book-card-cover"
          loading="lazy"
          onError={(e) => {
            e.target.src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=400&q=80";
          }}
        />
        <div className="book-card-overlay">
          <span>Click for details</span>
        </div>
      </div>

      <div className="book-card-content">
        <div className="book-card-header">
          <span className="book-card-category">{book.category || "General"}</span>
          <StatusBadge
            status={!isAvailable ? "out_of_stock" : isLowStock ? "low_stock" : "available"}
            label={!isAvailable ? "Out of Stock" : isLowStock ? "1 Copy Left" : `${book.available_copies} Available`}
          />
        </div>

        <h3 className="book-card-title" title={book.title} onClick={() => onViewDetails(book)}>
          {book.title}
        </h3>
        <p className="book-card-author">by {book.author}</p>

        <p className="book-card-desc">
          {book.description ? book.description.substring(0, 100) + "..." : "No description available."}
        </p>

        <div className="book-card-footer">
          <div className="book-card-copies">
            <strong>{book.available_copies}</strong> of {book.total_copies} copies
          </div>

          <div className="book-card-actions">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => onViewDetails(book)}
            >
              Details
            </button>

            {userHasBorrowed ? (
              <button type="button" className="btn-secondary-sm" disabled>
                Borrowed
              </button>
            ) : isAvailable ? (
              <button
                type="button"
                className="btn-primary-sm"
                onClick={() => onBorrow(book)}
                disabled={isBorrowing}
              >
                {isBorrowing ? "Borrowing..." : "Borrow"}
              </button>
            ) : (
              <button type="button" className="btn-disabled-sm" disabled>
                Unavailable
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
