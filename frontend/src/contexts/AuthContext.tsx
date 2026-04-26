import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { useNavigate } from "react-router-dom";
import type { AuthUser } from "../lib/auth";
import { clearToken, getStoredUser, getToken, setToken, setUser } from "../lib/auth";
import { fetchMe, login as apiLogin, logout as apiLogout, signup as apiSignup } from "../lib/api";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  authenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
  signup: (name: string, email: string, password: string, role?: string, redirectTo?: string, teacherCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    authenticated: false
  });
  const navigate = useNavigate();

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setState({ user: null, loading: false, authenticated: false });
      return;
    }
    try {
      const user = await fetchMe();
      const fullUser: AuthUser = { id: user.id, name: user.name, email: user.email, role: user.role, student_id: user.student_id, created_at: user.created_at };
      setState({
        user: fullUser,
        loading: false,
        authenticated: true
      });
      setUser(fullUser);
    } catch {
      clearToken();
      setState({ user: null, loading: false, authenticated: false });
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setState({ user: null, loading: false, authenticated: false });
      return;
    }
    const stored = getStoredUser();
    if (stored) {
      setState({ user: stored, loading: false, authenticated: true });
      refreshUser();
    } else {
      refreshUser();
    }
  }, [refreshUser]);

  useEffect(() => {
    const onUnauthorized = () => {
      setState({ user: null, loading: false, authenticated: false });
      navigate("/login");
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, [navigate]);

  const login = useCallback(
    async (email: string, password: string, redirectTo?: string) => {
      const res = await apiLogin({ email, password });
      setToken(res.access_token);
      setUser(res.user);
      setState({
        user: res.user,
        loading: false,
        authenticated: true
      });
      navigate(redirectTo || "/dashboard", { replace: true });
    },
    [navigate]
  );

  const signup = useCallback(
    async (name: string, email: string, password: string, role?: string, redirectTo?: string, teacherCode?: string) => {
      const res = await apiSignup({ name, email, password, role: role || "student", teacher_code: teacherCode });
      setToken(res.access_token);
      setUser(res.user);
      setState({
        user: res.user,
        loading: false,
        authenticated: true
      });
      navigate(redirectTo || "/dashboard", { replace: true });
    },
    [navigate]
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* ignore */
    }
    clearToken();
    setState({ user: null, loading: false, authenticated: false });
    navigate("/");
  }, [navigate]);

  const value: AuthContextValue = {
    ...state,
    login,
    signup,
    logout,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
