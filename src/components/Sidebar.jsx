import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "./StatusBadge";

export default function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, role, isAdmin, signOut } = useAuth();

  const isAdminSection = location.pathname.startsWith("/admin");

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      navigate("/login");
    }
  };

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-logo">
          <span className="logo-emoji">📚</span>
          <div>
            <h2>LibraryHub</h2>
            <small>Smart Library Management</small>
          </div>
          <button className="sidebar-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* User Card */}
        <div className="sidebar-user-pill">
          <div className="pill-avatar">
            {(profile?.name || "U").charAt(0).toUpperCase()}
          </div>
          <div className="pill-meta">
            <span className="pill-name">{profile?.name || "Library User"}</span>
            <StatusBadge status={role} label={role === "admin" ? "Administrator" : "Member"} />
          </div>
        </div>

        <nav className="sidebar-nav">
          {isAdmin && (
            <div className="role-switcher">
              <NavLink
                to={isAdminSection ? "/dashboard" : "/admin"}
                className="role-switch-btn"
                onClick={handleLinkClick}
              >
                {isAdminSection ? "⇄ Switch to Member View" : "⇄ Switch to Admin View"}
              </NavLink>
            </div>
          )}

          {isAdminSection ? (
            <>
              <p className="nav-title">ADMINISTRATION</p>

              <NavLink
                to="/admin"
                end
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                onClick={handleLinkClick}
              >
                <span className="nav-icon">📊</span>
                Dashboard
              </NavLink>

              <NavLink
                to="/admin/books"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                onClick={handleLinkClick}
              >
                <span className="nav-icon">📚</span>
                Book Management
              </NavLink>

              <NavLink
                to="/admin/members"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                onClick={handleLinkClick}
              >
                <span className="nav-icon">👥</span>
                Members Directory
              </NavLink>

              <NavLink
                to="/admin/borrowings"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                onClick={handleLinkClick}
              >
                <span className="nav-icon">🔄</span>
                All Borrowings
              </NavLink>

              <NavLink
                to="/admin/overdue"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                onClick={handleLinkClick}
              >
                <span className="nav-icon">⚠️</span>
                Overdue & Fines
              </NavLink>

              <NavLink
                to="/admin/inventory"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                onClick={handleLinkClick}
              >
                <span className="nav-icon">📦</span>
                Inventory Health
              </NavLink>
            </>
          ) : (
            <>
              <p className="nav-title">MAIN MENU</p>

              <NavLink
                to="/dashboard"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                onClick={handleLinkClick}
              >
                <span className="nav-icon">⌂</span>
                Dashboard
              </NavLink>

              <NavLink
                to="/books"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                onClick={handleLinkClick}
              >
                <span className="nav-icon">📖</span>
                Browse Books
              </NavLink>

              <NavLink
                to="/my-books"
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                onClick={handleLinkClick}
              >
                <span className="nav-icon">📚</span>
                My Books
              </NavLink>
            </>
          )}

          <p className="nav-title">ACCOUNT</p>

          <NavLink
            to="/profile"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            onClick={handleLinkClick}
          >
            <span className="nav-icon">👤</span>
            My Profile
          </NavLink>

          <button className="nav-link logout-link" onClick={handleLogout}>
            <span className="nav-icon">↪</span>
            Sign Out
          </button>
        </nav>
      </aside>
    </>
  );
}