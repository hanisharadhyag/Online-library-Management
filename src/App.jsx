import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Books from "./pages/Books";
import MyBooks from "./pages/MyBooks";
import Profile from "./pages/Profile";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBooks from "./pages/admin/AdminBooks";
import AdminMembers from "./pages/admin/AdminMembers";
import AdminBorrowings from "./pages/admin/AdminBorrowings";
import AdminOverdue from "./pages/admin/AdminOverdue";
import AdminInventory from "./pages/admin/AdminInventory";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Member Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/books"
            element={
              <ProtectedRoute>
                <Books />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-books"
            element={
              <ProtectedRoute>
                <MyBooks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Admin Protected Routes */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/books"
            element={
              <AdminRoute>
                <AdminBooks />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/members"
            element={
              <AdminRoute>
                <AdminMembers />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/borrowings"
            element={
              <AdminRoute>
                <AdminBorrowings />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/overdue"
            element={
              <AdminRoute>
                <AdminOverdue />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/inventory"
            element={
              <AdminRoute>
                <AdminInventory />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/profile"
            element={
              <AdminRoute>
                <Profile />
              </AdminRoute>
            }
          />

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;