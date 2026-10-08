import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "./StatusBadge";

export default function Navbar({ onToggleSidebar, activeOverdueCount = 0 }) {
  const { user, profile, role, isAdmin } = useAuth();

  const displayName = profile?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Member";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
        >
          ☰
        </button>

        <div className="mobile-title">
          <span>📚</span>
          <strong>LibraryHub</strong>
        </div>
      </div>

      <div className="topbar-center">
        <div className="topbar-search">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Search catalog, authors, categories..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target.value.trim()) {
                window.location.href = `/books?q=${encodeURIComponent(e.target.value.trim())}`;
              }
            }}
          />
        </div>
      </div>

      <div className="topbar-right">
        {isAdmin && (
          <Link to="/admin" className="admin-badge-link">
            ⚙️ Admin Panel
          </Link>
        )}

        <Link to="/my-books" className="notification-btn" title="View your borrowings">
          🔔
          {activeOverdueCount > 0 && (
            <span className="notification-dot" title={`${activeOverdueCount} Overdue Books!`}>
              {activeOverdueCount}
            </span>
          )}
        </Link>

        <Link to="/profile" className="user-profile-link">
          <div className="avatar">{initial}</div>
          <div className="user-details">
            <strong>{displayName}</strong>
            <StatusBadge status={role} label={role === "admin" ? "Admin" : "Member"} />
          </div>
        </Link>
      </div>
    </header>
  );
}