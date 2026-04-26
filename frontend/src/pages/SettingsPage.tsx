import { Link } from "react-router-dom";
import { KidIcon } from "../components/KidIcon";
import { useAuth } from "../contexts/AuthContext";

export function SettingsPage() {
  const { logout } = useAuth();

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <span className="hero-badge">Settings</span>
          <h1>Settings</h1>
          <p>Manage your preferences and access app information.</p>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h3>Menu</h3>
          <p>Same typography and spacing across the web app.</p>
        </div>
        <nav className="settings-menu">
          <Link to="/about" className="settings-item">
            <KidIcon name="book" />
            <span>About</span>
          </Link>
          <Link to="/help" className="settings-item">
            <KidIcon name="target" />
            <span>Help</span>
          </Link>
          <Link to="/privacy" className="settings-item">
            <KidIcon name="note" />
            <span>Privacy</span>
          </Link>
          <Link to="/terms" className="settings-item">
            <KidIcon name="clipboard" />
            <span>Terms</span>
          </Link>
          <button
            type="button"
            className="settings-item settings-logout"
            onClick={() => {
              void logout();
            }}
          >
            <KidIcon name="x" />
            <span>Logout</span>
          </button>
        </nav>
      </section>
    </div>
  );
}
