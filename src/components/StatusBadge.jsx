export default function StatusBadge({ status, label }) {
  const norm = (status || "").toLowerCase();

  const configs = {
    borrowed: { text: label || "Borrowed", cls: "badge-borrowed" },
    returned: { text: label || "Returned", cls: "badge-returned" },
    overdue: { text: label || "Overdue", cls: "badge-overdue" },
    available: { text: label || "Available", cls: "badge-available" },
    low_stock: { text: label || "Low Stock", cls: "badge-warning" },
    out_of_stock: { text: label || "Out of Stock", cls: "badge-danger" },
    member: { text: label || "Member", cls: "badge-member" },
    admin: { text: label || "Admin", cls: "badge-admin" },
  };

  const item = configs[norm] || { text: label || status, cls: "badge-default" };

  return <span className={`badge ${item.cls}`}>{item.text}</span>;
}
