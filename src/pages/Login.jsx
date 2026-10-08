import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ConfigBanner from "../components/ConfigBanner";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      const { profile } = await signIn(email.trim(), password);

      // Redirect according to role
      const role = profile?.role || "member";
      const from = location.state?.from?.pathname;

      if (from && from !== "/login" && from !== "/register") {
        navigate(from, { replace: true });
      } else if (role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      console.error("Login failed:", err);
      if (err.message?.includes("Invalid login credentials")) {
        setError("Invalid email or password. Please try again or create an account.");
      } else if (err.message?.includes("Email not confirmed")) {
        setError("Please check your email to confirm your account first.");
      } else {
        setError(err.message || "Failed to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* LEFT HERO SECTION */}
      <div className="auth-left">
        <div className="auth-brand">
          <div className="brand-icon">📚</div>
          <div>
            <h2>LibraryHub</h2>
            <span>Smart Library Management</span>
          </div>
        </div>

        <div className="auth-hero">
          <span className="hero-badge">✦ SMART LIBRARY PLATFORM</span>

          <h1>
            Your library,
            <br />
            <span>simplified.</span>
          </h1>

          <p>
            Discover books, manage your borrowings, and stay on top of your
            reading journey — all in one modern place.
          </p>

          <div className="hero-features">
            <div>
              <strong>1,248+</strong>
              <span>Books</span>
            </div>
            <div>
              <strong>500+</strong>
              <span>Members</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Access</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT LOGIN FORM */}
      <div className="auth-right">
        <div className="login-card">
          <ConfigBanner />

          <div className="mobile-logo">📚</div>

          <h1>Welcome back</h1>
          <p className="login-subtitle">Sign in to continue to your library</p>

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="input-group">
              <div className="password-label">
                <label>Password</label>
              </div>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && <div className="login-error">⚠ {error}</div>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
              <span>→</span>
            </button>
          </form>

          <div className="divider">
            <span>OR</span>
          </div>

          <p className="register-text">
            Don't have an account?
            <Link to="/register">Create an account</Link>
          </p>

          <p className="login-footer">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;