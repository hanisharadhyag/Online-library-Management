export default function SearchBar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories = [],
  onlyAvailable,
  onOnlyAvailableChange,
  sortBy,
  onSortByChange,
}) {
  return (
    <div className="search-filter-bar">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Search by title, author, or ISBN..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onSearchChange("")}
          >
            ✕
          </button>
        )}
      </div>

      <div className="filter-controls">
        <select
          className="select-control"
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="All">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {onSortByChange && (
          <select
            className="select-control"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
          >
            <option value="title_asc">Title (A-Z)</option>
            <option value="title_desc">Title (Z-A)</option>
            <option value="available_desc">Most Available</option>
            <option value="newest">Recently Added</option>
          </select>
        )}

        {onOnlyAvailableChange && (
          <label className="checkbox-toggle">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => onOnlyAvailableChange(e.target.checked)}
            />
            <span>Available only</span>
          </label>
        )}
      </div>
    </div>
  );
}
