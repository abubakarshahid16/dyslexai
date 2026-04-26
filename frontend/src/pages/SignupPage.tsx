import { useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { signup as apiSignup } from "../lib/api";
import { KidIcon } from "../components/KidIcon";

export function SignupPage() {
  const { authenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const forceSignup = new URLSearchParams(location.search).get("fresh") === "1";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [teacherCode, setTeacherCode] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setBusy(true);
    try {
      await apiSignup({
        name,
        email,
        password,
        role,
        teacher_code: role === "teacher" ? teacherCode : undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  if (authenticated && !forceSignup) return <Navigate to={from || "/dashboard"} replace />;

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎉</div>
          <h1 style={{ marginBottom: 8 }}>Account Created!</h1>
          <p className="auth-subtitle" style={{ marginBottom: 24 }}>
            Your account has been successfully created. Please log in to continue.
          </p>
          <button
            className="primary-button auth-submit"
            onClick={() => navigate("/login", { replace: true })}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create Account</h1>
        <p className="auth-subtitle">Sign up to start using DyslexAI</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            <span>I am a</span>
            <div className="role-toggle">
              <button
                type="button"
                className={`role-btn ${role === "student" ? "role-btn-active" : ""}`}
                onClick={() => setRole("student")}
                disabled={busy}
              >
                <KidIcon name="studentCap" /> Student
              </button>
              <button
                type="button"
                className={`role-btn ${role === "teacher" ? "role-btn-active" : ""}`}
                onClick={() => setRole("teacher")}
                disabled={busy}
              >
                <KidIcon name="teacherBook" /> Teacher
              </button>
            </div>
          </label>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              disabled={busy}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={busy}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              disabled={busy}
            />
          </label>
          <label className="field">
            <span>Confirm Password</span>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              disabled={busy}
            />
          </label>
          <label className="auth-password-toggle">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              disabled={busy}
            />
            <span>Show password</span>
          </label>
          {role === "teacher" && (
            <label className="field">
              <span>Teacher Access Code</span>
              <input
                type="password"
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value)}
                placeholder="Enter your access code"
                required
                disabled={busy}
              />
              <span style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)", marginTop: 4 }}>
                Contact your administrator for the teacher access code.
              </span>
            </label>
          )}
          <button type="submit" className="primary-button auth-submit" disabled={busy}>
            {busy ? "Signing up…" : "Sign Up"}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
