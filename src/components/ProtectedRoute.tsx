import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Loading and error UI configuration
const PROTECTED_ROUTE_CONFIG = {
  LOADER_SIZE: 'h-12 w-12',
  LOADER_COLOR: 'border-b-2 border-blue-600',
  MIN_HEIGHT: 'min-h-screen',
};

// Error messages
const ERROR_MESSAGES = {
  ACCESS_DENIED_TITLE: 'Access Denied',
  ACCESS_DENIED_SUBTITLE: "You don't have permission to access this page.",
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'auditor';
}

/**
 * Loading spinner component
 */
const LoadingSpinner = () => (
  <div className={`flex items-center justify-center ${PROTECTED_ROUTE_CONFIG.MIN_HEIGHT}`}>
    <div className={`animate-spin rounded-full ${PROTECTED_ROUTE_CONFIG.LOADER_SIZE} ${PROTECTED_ROUTE_CONFIG.LOADER_COLOR}`}></div>
  </div>
);

/**
 * Access denied error component
 */
const AccessDeniedError = () => (
  <div className={`flex items-center justify-center ${PROTECTED_ROUTE_CONFIG.MIN_HEIGHT}`}>
    <div className="text-center">
      <h1 className="text-2xl font-bold text-red-600">{ERROR_MESSAGES.ACCESS_DENIED_TITLE}</h1>
      <p className="text-gray-600 mt-2">{ERROR_MESSAGES.ACCESS_DENIED_SUBTITLE}</p>
    </div>
  </div>
);

/**
 * Protected route component
 * Ensures user is authenticated and has required role (if specified)
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access control if required role is specified
  if (requiredRole && user?.role !== requiredRole) {
    return <AccessDeniedError />;
  }

  return <>{children}</>;
};
