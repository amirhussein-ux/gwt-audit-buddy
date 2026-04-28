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
    PROFILE: '/auth/profile',
    SETTINGS: '/auth/settings',
    CHANGE_PASSWORD: '/auth/change-password',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  HEADERS: {
    CONTENT_TYPE: 'application/json',
    AUTHORIZATION_PREFIX: 'Bearer',
  },
};

export interface AgencySummary {
  id?: string;
  name: string;
  acronym?: string;
  region?: string;
  domainUrl?: string;
  agencyType?: string;
}

export interface UserSettings {
  auditDefaults: {
    maxPages: number;
    maxDepth: number;
    concurrency: number;
  };
  notifications: {
    inAppEnabled: boolean;
    emailEnabled: boolean;
    auditCompleted: boolean;
    auditFailed: boolean;
    archiveEvents: boolean;
    complianceDigest: boolean;
  };
  dashboard: {
    landingPage: 'dashboard' | 'results' | 'audit-log' | 'archive';
    showAgencyLeaderboard: boolean;
    showTrendChart: boolean;
    showCriticalAlerts: boolean;
  };
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'auditor';
  agency?: AgencySummary | string | null;
  fullName?: string;
  positionTitle?: string;
  officePhone?: string;
  mobileNumber?: string;
  isEmailVerified?: boolean;
  lastLogin?: string | null;
  settings: UserSettings;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  verifySession: () => Promise<boolean>;
  refreshUser: () => Promise<User | null>;
  updateProfile: (payload: Partial<Pick<User, 'username' | 'fullName' | 'positionTitle' | 'officePhone' | 'mobileNumber'>>) => Promise<User>;
  updateSettings: (settings: UserSettings) => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Step 1: sends reset link if email exists. Always shows generic message. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Step 2: submits new password with the token from the reset link. */
  resetPassword: (email: string, token: string, password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
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

  const buildAuthHeaders = useCallback((authToken: string, includeContentType = true) => {
    const headers: Record<string, string> = {
      Authorization: `${AUTH_CONFIG.HEADERS.AUTHORIZATION_PREFIX} ${authToken}`,
    };

    if (includeContentType) {
      headers['Content-Type'] = AUTH_CONFIG.HEADERS.CONTENT_TYPE;
    }

    return headers;
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return null;

    const response = await fetch(`${API_BASE}${AUTH_CONFIG.ENDPOINTS.PROFILE}`, {
      headers: buildAuthHeaders(token),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh user profile');
    }

    const data = await response.json();
    setUser(data.user);
    return data.user as User;
  }, [API_BASE, buildAuthHeaders, token]);

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
          const errorText = await response.text().catch(() => '');
          let errorMessage = 'Login failed';

          if (errorText) {
            try {
              const error = JSON.parse(errorText);
              errorMessage = error?.error || error?.message || errorText;
            } catch {
              errorMessage = errorText;
            }
          }

          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Store token and user info
        localStorage.setItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_TOKEN, data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user as User;
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
        headers: buildAuthHeaders(token),
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
        if (data.user) {
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
  }, [token, API_BASE, buildAuthHeaders]);

  const updateProfile = useCallback(
    async (payload: Partial<Pick<User, 'username' | 'fullName' | 'positionTitle' | 'officePhone' | 'mobileNumber'>>) => {
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE}${AUTH_CONFIG.ENDPOINTS.PROFILE}`, {
        method: 'PUT',
        headers: buildAuthHeaders(token),
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setUser(data.user);
      return data.user as User;
    },
    [API_BASE, buildAuthHeaders, token]
  );

  const updateSettings = useCallback(
    async (settings: UserSettings) => {
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE}${AUTH_CONFIG.ENDPOINTS.SETTINGS}`, {
        method: 'PUT',
        headers: buildAuthHeaders(token),
        body: JSON.stringify(settings),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }

      setUser(data.user);
      return data.user as User;
    },
    [API_BASE, buildAuthHeaders, token]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_BASE}${AUTH_CONFIG.ENDPOINTS.CHANGE_PASSWORD}`, {
        method: 'POST',
        headers: buildAuthHeaders(token),
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      localStorage.removeItem(AUTH_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      setToken(null);
      setUser(null);
    },
    [API_BASE, buildAuthHeaders, token]
  );

  /**
   * Step 1 — Forgot Password
   * Sends a reset link to the email if it exists in the database.
   * Always resolves (never rejects on "email not found") to prevent
   * user enumeration — the backend already returns a generic message.
   */
  const requestPasswordReset = useCallback(
    async (email: string) => {
      const response = await fetch(`${API_BASE}${AUTH_CONFIG.ENDPOINTS.FORGOT_PASSWORD}`, {
        method: 'POST',
        headers: { 'Content-Type': AUTH_CONFIG.HEADERS.CONTENT_TYPE },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        // Only throw on server errors (5xx) — 200 with generic message is the expected success path
        throw new Error(error.error || 'Password reset request failed. Please try again.');
      }
      // Callers can ignore the response body — the UI shows a generic success message regardless
    },
    [API_BASE]
  );

  /**
   * Step 2 — Reset Password
   * Submits the new password along with email + token from the reset link.
   * Throws with a user-friendly message if the token is invalid or expired.
   */
  const resetPassword = useCallback(
    async (email: string, token: string, password: string) => {
      const response = await fetch(`${API_BASE}${AUTH_CONFIG.ENDPOINTS.RESET_PASSWORD}`, {
        method: 'POST',
        headers: { 'Content-Type': AUTH_CONFIG.HEADERS.CONTENT_TYPE },
        body: JSON.stringify({ email, token, password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Password reset failed. The link may have expired.');
      }
    },
    [API_BASE]
  );

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    verifySession,
    refreshUser,
    updateProfile,
    updateSettings,
    changePassword,
    requestPasswordReset,
    resetPassword,
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
