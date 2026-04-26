import { Link } from "react-router-dom";
import { KidIcon } from "../components/KidIcon";

export function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-hero">
        <div className="landing-logo" aria-hidden>
          <KidIcon name="book" />
        </div>
        <h1>DyslexAI</h1>
        <p className="landing-tagline">
          Dyslexia Learning Assistant.
        </p>
        <div className="landing-actions">
          <Link to="/signup?fresh=1" className="primary-button landing-cta">
            Get Started
          </Link>
          <Link to="/login" className="secondary-button">
            I already have an account
          </Link>
        </div>
      </div>
    </div>
  );
}
