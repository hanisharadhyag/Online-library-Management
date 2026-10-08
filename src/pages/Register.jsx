import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ConfigBanner from "../components/ConfigBanner";

function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!form.name.trim() || !form.email.trim() || !form.password || !form.confirmPassword) {
      setError("Please fill in all required fields.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const res = await signUp(form.name.trim(), form.email.trim(), form.password);

      if (res.session) {
        // User is logged in automatically
        navigate("/dashboard", { replace: true });
      } else {
        // Confirmation email might be required
        setSuccessMessage("Account created successfully! You can now log in with your credentials.");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      }
    } catch (err) {
      console.error("Registration error:", err);
      if (err.message?.includes("User already registered")) {
        setError("An account with this email already exists. Please sign in instead.");
      } else {
        setError(err.message || "Unable to register. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* LEFT SIDE */}
      <div className="auth-left">
        <div className="auth-brand">
          <div className="brand-icon">📚</div>
          <div>
            <h2>LibraryHub</h2>
            <span>Smart Library Management</span>
          </div>
        </div>

        <div className="auth-hero">
          <span className="hero-badge">✦ JOIN THE LIBRARY</span>

          <h1>
            Start your
            <br />
            <span>reading journey.</span>
          </h1>

          <p>
            Create your LibraryHub account and discover, borrow, and manage your
            favourite books from one simple platform.
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

      {/* RIGHT SIDE */}
      <div className="auth-right">
        <div className="login-card">
          <ConfigBanner />

          <div className="mobile-logo">📚</div>

          <h1>Create account</h1>
          <p className="login-subtitle">Join LibraryHub and start exploring</p>

          <form onSubmit={handleRegister}>
            <div className="input-group">
              <label>Full name</label>
              <input
                type="text"
                name="name"
                placeholder="e.g. John Doe"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="input-group">
              <label>Email address</label>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="input-group">
              <label>Confirm password</label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Repeat password"
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>

            {error && <div className="login-error">⚠ {error}</div>}
            {successMessage && <div className="login-success">✓ {successMessage}</div>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
              <span>→</span>
            </button>
          </form>

          <div className="divider">
            <span>OR</span>
          </div>

          <p className="register-text">
            Already have an account?
            <Link to="/login">Sign in</Link>
          </p>

          <p className="login-footer">
            By creating an account, you agree to our Terms of Service and Privacy
            Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;