import React, { createContext, useState, useCallback, useEffect } from 'react';

// Constants
const AUTH_CONFIG = {
  STORAGE_KEYS: {
    AUTH_TOKEN: 'authToken',
    LAST_AUDIT_RESULT: 'lastAuditResult',
    ACTIVE_AUDIT: 'activeAudit',
    AUDIT_STEPS: 'auditSteps',
  },
  ENDPOINTS: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    VERIFY: '/auth/verify',
  },
  HEADERS: {
    CONTENT_TYPE: 'application/json',
    AUTHORIZATION_PREFIX: 'Bearer',
  },
};

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'auditor' | 'viewer';
  agency?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifySession: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    // Load from localStorage on init
    return typeof window !== 'undefined' ? localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_TOKEN) : null;
  });
  // Start as true when a token exists so ProtectedRoute waits for
  // the initial verifySession() call before deciding to redirect.
  const [isLoading, setIsLoading] = useState(() =>
    typeof window !== 'undefined' ? !!localStorage.getItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_TOKEN) : false
  );

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  /**
   * Set up Authorization header on token change
   * Token is automatically included in all fetch requests via useAuthenticatedFetch hook
   */
  useEffect(() => {
    if (token) {
      // Token is securely stored and passed via headers in authenticated requests
      console.log('[Auth] Token set and ready for authenticated requests');
    }
  }, [token]);

  /**
   * Verify current session on mount.
   * isLoading is initialised to true when a stored token exists, so
   * ProtectedRoute renders the spinner instead of redirecting while
   * the verification request is in flight.
   */
  useEffect(() => {
    if (token) {
      verifySession().finally(() => setIsLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  /**
   * Login with email and password
   */
  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}${AUTH_CONFIG.ENDPOINTS.LOGIN}`, {
          method: 'POST',
          headers: { 'Content-Type': AUTH_CONFIG.HEADERS.CONTENT_TYPE },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Login failed');
        }

        const data = await response.json();

        // Store token and user info
        localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_TOKEN, data.token);
        setToken(data.token);
        setUser(data.user);
      } catch (error) {
        console.error('[Auth] Login error:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [API_BASE]
  );

  /**
   * Logout and revoke session
   */
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      if (token) {
        await fetch(`${API_BASE}${AUTH_CONFIG.ENDPOINTS.LOGOUT}`, {
          method: 'POST',
          headers: {
            'Authorization': `${AUTH_CONFIG.HEADERS.AUTHORIZATION_PREFIX} ${token}`,
            'Content-Type': AUTH_CONFIG.HEADERS.CONTENT_TYPE,
          },
        });
      }
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    } finally {
      // Clear local state and user-specific storage
      localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.LAST_AUDIT_RESULT); // Clear audit result from Dashboard
      setToken(null);
      setUser(null);
      setIsLoading(false);
    }
  }, [token, API_BASE]);

  /**
   * Verify and refresh session
   */
  const verifySession = useCallback(async () => {
    if (!token) return false;

    try {
      // Set Authorization header for this request
      const response = await fetch(`${API_BASE}${AUTH_CONFIG.ENDPOINTS.VERIFY}`, {
        headers: {
          'Authorization': `${AUTH_CONFIG.HEADERS.AUTHORIZATION_PREFIX} ${token}`,
          'Content-Type': AUTH_CONFIG.HEADERS.CONTENT_TYPE,
        },
      });

      if (!response.ok) {
        // Token invalid or expired - clear auth state
        localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        setToken(null);
        setUser(null);
        return false;
      }

      const data = await response.json();
      if (data.valid) {
        // Verification successful - ensure user data is loaded
        if (!user && data.user) {
          setUser(data.user);
        }
        return true;
      } else {
        // Verification returned false - clear auth
        localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        setToken(null);
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('[Auth] Session verification error:', error);
      // On network error, keep the token but return false
      // This prevents logging out on temporary network issues
      return false;
    }
  }, [token, API_BASE, user]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    verifySession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to get auth context with error handling
 */
export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

/**
 * Helper hook to make authenticated API calls
 * Automatically includes Bearer token in Authorization header
 */
export const useAuthenticatedFetch = () => {
  const { token } = useAuth();

  return useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers || {});
      
      // Add Bearer token to Authorization header
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [token]
  );
};