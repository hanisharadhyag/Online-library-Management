export default function EmptyState({
  icon = "📚",
  title = "No items found",
  description = "There are no records matching your criteria.",
  actionText,
  onAction,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn-primary empty-state-btn">
          {actionText}
        </button>
      )}
    </div>
  );
}
