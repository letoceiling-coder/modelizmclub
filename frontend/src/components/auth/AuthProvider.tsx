import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getAuthToken, setAuthToken } from "@/lib/api/auth";
import {
  authUserDisplayName,
  authUserSlug,
  fetchCurrentUser,
  loginWithApi,
  logoutFromApi,
  registerWithApi,
  verifyEmailWithApi,
  type AuthUser,
} from "@/lib/api/auth-api";
import { registerApiUser } from "@/lib/mock";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: {
    email: string;
    password: string;
    password_confirmation: string;
    display_name?: string;
  }) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  displayName: string | null;
  slug: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function syncUserToMock(user: AuthUser): void {
  registerApiUser({
    slug: authUserSlug(user),
    displayName: authUserDisplayName(user),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getAuthToken()) {
      setUser(null);
      return;
    }
    const me = await fetchCurrentUser();
    if (me) syncUserToMock(me);
    setUser(me);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!getAuthToken()) {
          if (!cancelled) setUser(null);
          return;
        }
        const me = await fetchCurrentUser();
        if (!cancelled) {
          if (me) syncUserToMock(me);
          setUser(me);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const loggedIn = await loginWithApi(email, password);
    syncUserToMock(loggedIn);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      password_confirmation: string;
      display_name?: string;
    }) => {
      await registerWithApi(input);
    },
    [],
  );

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const verified = await verifyEmailWithApi(email, code);
    syncUserToMock(verified);
    setUser(verified);
    return verified;
  }, []);

  const logout = useCallback(async () => {
    await logoutFromApi();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user && getAuthToken()),
      login,
      register,
      verifyEmail,
      logout,
      refresh,
      displayName: user ? authUserDisplayName(user) : null,
      slug: user ? authUserSlug(user) : null,
    }),
    [user, loading, login, register, verifyEmail, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** React to global 401 from apiRequest */
export function AuthSessionGuard() {
  const { refresh } = useAuth();
  useEffect(() => {
    const handler = () => {
      setAuthToken(null);
      void refresh();
    };
    window.addEventListener("modelizm:unauthorized", handler);
    return () => window.removeEventListener("modelizm:unauthorized", handler);
  }, [refresh]);
  return null;
}
