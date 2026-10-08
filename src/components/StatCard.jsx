export default function StatCard({
  title,
  value,
  icon,
  subtitle,
  color = "indigo",
  onClick,
}) {
  return (
    <div className={`stat-card stat-card-${color} ${onClick ? "stat-card-clickable" : ""}`} onClick={onClick}>
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        <div className="stat-card-icon">{icon}</div>
      </div>
      <div className="stat-card-value">{value}</div>
      {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
    </div>
  );
}
