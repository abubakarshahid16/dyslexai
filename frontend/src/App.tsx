import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./contexts/AuthContext";
import { KidIcon, type KidIconName } from "./components/KidIcon";
import { AboutPage } from "./pages/AboutPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExercisesPage } from "./pages/ExercisesPage";
import { HelpPage } from "./pages/HelpPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SignupPage } from "./pages/SignupPage";
import { StudentPage } from "./pages/StudentPage";
import StudentOcrStudioPage from "./pages/StudentOcrStudioPage";
import { TermsPage } from "./pages/TermsPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { AssignmentsPage } from "./pages/AssignmentsPage";
import { AssignmentStatusPage } from "./pages/AssignmentStatusPage";
import { GameProvider } from "./features/game-mode/GameContext";
import GameHomePage from "./features/game-mode/pages/GameHomePage";
import GameSessionPage from "./features/game-mode/pages/GameSessionPage";
import GameCompletePage from "./features/game-mode/pages/GameCompletePage";
import GamePuzzlePage from "./features/game-mode/pages/GamePuzzlePage";

const studentNavItems: Array<{ to: string; label: string; icon: KidIconName }> = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/exercises", label: "Exercises", icon: "pencil" },
  { to: "/assignments", label: "My Assignments", icon: "clipboard" },
  { to: "/ocr-studio", label: "OCR Studio", icon: "camera" },
  { to: "/game", label: "Daily Lessons", icon: "daily" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

const teacherNavItems: Array<{ to: string; label: string; icon: KidIconName }> = [
  { to: "/dashboard", label: "Dashboard", icon: "chart" },
  { to: "/workspace", label: "OCR Studio", icon: "camera" },
  { to: "/assignments", label: "Assignments", icon: "clipboard" },
  { to: "/assignment-status", label: "Assignment Status", icon: "check" },
  { to: "/students", label: "Students", icon: "users" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

function AppLayout() {
  const { user, logout } = useAuth();
  const navItems = user?.role === "teacher" ? teacherNavItems : studentNavItems;
  return (
    <ProtectedRoute>
      <GameProvider>
        <div className="app-shell">
          <aside className="sidebar">
            <NavLink to="/dashboard" className="brand">
              <div className="brand-mark">
                D
              </div>
              <div>
                <strong>DyslexAI</strong>
                <p>Dyslexia Learning Support</p>
              </div>
            </NavLink>

            <nav className="nav-list">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
                >
                  <span className="nav-link-icon" aria-hidden>
                    <KidIcon name={item.icon} />
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-footer">
              <span className="sidebar-user">{user?.email}</span>
              <button type="button" className="nav-link logout-btn" onClick={() => logout()}>
                Log out
              </button>
            </div>
          </aside>

          <main className="main-content">
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/exercises" element={<ExercisesPage />} />
              <Route path="/game" element={<GameHomePage />} />
              <Route path="/game/session" element={<GameSessionPage />} />
              <Route path="/game/complete" element={<GameCompletePage />} />
              <Route path="/game/puzzle/:phaseId" element={<GamePuzzlePage />} />
              <Route path="/ocr-studio" element={<StudentOcrStudioPage />} />
              <Route path="/workspace" element={<WorkspacePage />} />
              <Route path="/assignments" element={<AssignmentsPage />} />
              <Route path="/assignment-status" element={<AssignmentStatusPage />} />
              <Route path="/students" element={<StudentPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </GameProvider>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<AppLayout />} />
    </Routes>
  );
}
