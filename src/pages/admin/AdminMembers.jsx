import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import Layout from "../../components/Layout";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";

export default function AdminMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [roleDialog, setRoleDialog] = useState({ isOpen: false, member: null, targetRole: "" });
  const [changingRole, setChangingRole] = useState(false);
  const [notification, setNotification] = useState(null);

  const fetchMembersAndStats = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Fetch profiles
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (pErr) throw pErr;

      // 2. Fetch all borrowings to compute active count, overdue count, and total fines per user
      const { data: borrowings, error: bErr } = await supabase
        .from("borrowings")
        .select("user_id, status, fine, due_date, returned_at");

      if (bErr) throw bErr;

      const userStatsMap = {};
      const now = new Date();

      (borrowings || []).forEach((b) => {
        if (!userStatsMap[b.user_id]) {
          userStatsMap[b.user_id] = { active: 0, overdue: 0, totalFine: 0 };
        }
        userStatsMap[b.user_id].totalFine += Number(b.fine || 0);

        if (!b.returned_at) {
          userStatsMap[b.user_id].active += 1;
          if (new Date(b.due_date) < now || b.status === "overdue") {
            userStatsMap[b.user_id].overdue += 1;
          }
        }
      });

      // Merge stats into profiles
      const merged = (profiles || []).map((p) => {
        const s = userStatsMap[p.id] || { active: 0, overdue: 0, totalFine: 0 };
        return {
          ...p,
          activeCount: s.active,
          overdueCount: s.overdue,
          fineAmount: s.totalFine,
        };
      });

      setMembers(merged);
    } catch (err) {
      console.error("Error loading members:", err);
      setNotification({ type: "error", message: "Failed to load member records." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembersAndStats();
  }, [fetchMembersAndStats]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = m.name?.toLowerCase().includes(q);
        const mEmail = m.email?.toLowerCase().includes(q);
        if (!mName && !mEmail) return false;
      }

      // Filter by role / overdue
      if (filterRole === "members" && m.role !== "member") return false;
      if (filterRole === "admins" && m.role !== "admin") return false;
      if (filterRole === "overdue" && m.overdueCount === 0) return false;

      return true;
    });
  }, [members, searchQuery, filterRole]);

  const handleRoleChangeConfirm = async () => {
    if (!roleDialog.member) return;
    const { member, targetRole } = roleDialog;

    try {
      setChangingRole(true);
      const { error } = await supabase
        .from("profiles")
        .update({ role: targetRole })
        .eq("id", member.id);

      if (error) throw error;

      setNotification({
        type: "success",
        message: `Updated role for "${member.name || member.email}" to ${targetRole}.`,
      });
      setRoleDialog({ isOpen: false, member: null, targetRole: "" });
      await fetchMembersAndStats();
    } catch (err) {
      console.error("Role update error:", err);
      setNotification({
        type: "error",
        message: err.message || "Failed to update member role.",
      });
    } finally {
      setChangingRole(false);
    }
  };

  return (
    <Layout>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>Members Directory</h1>
            <p>Manage patrons, track active borrowings and overdue fines, and manage privileges.</p>
          </div>
          <div className="catalog-count-badge">
            <strong>{filteredMembers.length}</strong> members
          </div>
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
              placeholder="Search member by name or email..."
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
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="all">All Patrons ({members.length})</option>
              <option value="members">Standard Members</option>
              <option value="admins">Administrators</option>
              <option value="overdue">Has Overdue Books</option>
            </select>
          </div>
        </div>

        {/* Members Table */}
        {loading ? (
          <LoadingSpinner message="Loading member profiles..." />
        ) : filteredMembers.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No members found"
            description="No patron accounts matched your search criteria."
          />
        ) : (
          <div className="borrowings-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patron</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Member Since</th>
                  <th>Active Borrows</th>
                  <th>Overdue Books</th>
                  <th>Total Fines</th>
                  <th>Role Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => {
                  const createdDate = new Date(m.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const isCurrentAdmin = m.role === "admin";

                  return (
                    <tr key={m.id} className={m.overdueCount > 0 ? "row-overdue" : ""}>
                      <td className="user-cell">
                        <div className="avatar-sm">
                          {(m.name || m.email || "U").charAt(0).toUpperCase()}
                        </div>
                        <strong>{m.name || "Library Member"}</strong>
                      </td>

                      <td>
                        <span className="text-muted">{m.email}</span>
                      </td>

                      <td>
                        <StatusBadge
                          status={m.role}
                          label={isCurrentAdmin ? "Admin" : "Member"}
                        />
                      </td>

                      <td>{createdDate}</td>

                      <td>
                        <strong>{m.activeCount}</strong> books
                      </td>

                      <td>
                        {m.overdueCount > 0 ? (
                          <span className="text-danger font-bold">
                            ⚠️ {m.overdueCount} overdue
                          </span>
                        ) : (
                          <span className="text-muted">0</span>
                        )}
                      </td>

                      <td>
                        {m.fineAmount > 0 ? (
                          <span className="text-danger font-bold">₹{m.fineAmount}</span>
                        ) : (
                          <span className="text-muted">₹0</span>
                        )}
                      </td>

                      <td>
                        {isCurrentAdmin ? (
                          <button
                            type="button"
                            className="btn-outline-sm"
                            onClick={() =>
                              setRoleDialog({
                                isOpen: true,
                                member: m,
                                targetRole: "member",
                              })
                            }
                          >
                            Demote to Member
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary-sm"
                            onClick={() =>
                              setRoleDialog({
                                isOpen: true,
                                member: m,
                                targetRole: "admin",
                              })
                            }
                          >
                            Promote to Admin
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Role Change Confirmation Dialog */}
        <ConfirmDialog
          isOpen={roleDialog.isOpen}
          title={
            roleDialog.targetRole === "admin"
              ? "Promote to Administrator"
              : "Demote to Member"
          }
          message={`Are you sure you want to change role for "${roleDialog.member?.name || roleDialog.member?.email}" to "${roleDialog.targetRole}"?`}
          confirmText="Confirm Role Change"
          isLoading={changingRole}
          onConfirm={handleRoleChangeConfirm}
          onCancel={() => setRoleDialog({ isOpen: false, member: null, targetRole: "" })}
        />
      </div>
    </Layout>
  );
}
