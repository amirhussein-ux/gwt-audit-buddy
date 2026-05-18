import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import { AppErrorBoundary } from "@/components/error-boundaries/AppErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageSkeleton } from "@/components/states";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Splashscreen from "@/pages/Splashscreen";

const MainLayout = lazy(() => import("@/components/MainLayout"));
const Index = lazy(() => import("./pages/Index"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ResultsPage = lazy(() => import("./pages/ResultsPage"));
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));
const AuditDetailPage = lazy(() => import("./pages/AuditDetailPage"));
const ArchivePage = lazy(() => import("./pages/ArchivePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnReconnect: true,
    },
  },
});

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background p-6">
      <PageSkeleton variant="cards" cardCount={2} />
    </div>
  );
}

interface ProtectedShellRouteProps {
  children: ReactNode;
  routeName: string;
  requiredRole?: string;
}

function ProtectedShellRoute({
  children,
  routeName,
  requiredRole,
}: ProtectedShellRouteProps) {
  const location = useLocation();
  const resetKeys = [location.pathname];

  return (
    <ProtectedRoute requiredRole={requiredRole}>
      <AppErrorBoundary
        resetKeys={resetKeys}
        title="The application shell encountered an unexpected problem"
        description="Try reloading this area. If the issue persists, you can still navigate back after retrying."
      >
        <MainLayout>
          <AppErrorBoundary
            resetKeys={resetKeys}
            fullPage={false}
            title={`${routeName} could not be displayed`}
            description="This page section failed unexpectedly, but the navigation shell is still available."
          >
            {children}
          </AppErrorBoundary>
        </MainLayout>
      </AppErrorBoundary>
    </ProtectedRoute>
  );
}

const App = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {loading && <Splashscreen />}

      {!loading && (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />

                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedShellRoute routeName="Dashboard">
                            <Dashboard />
                        </ProtectedShellRoute>
                      }
                    />

                    <Route
                      path="/results"
                      element={
                        <ProtectedShellRoute routeName="Results">
                            <ResultsPage />
                        </ProtectedShellRoute>
                      }
                    />

                    <Route
                      path="/audit-log"
                      element={
                        <ProtectedShellRoute routeName="Audit Log">
                            <AuditLogPage />
                        </ProtectedShellRoute>
                      }
                    />

                    <Route
                      path="/audit/:id"
                      element={
                        <ProtectedShellRoute routeName="Audit Details">
                            <AuditDetailPage />
                        </ProtectedShellRoute>
                      }
                    />

                    <Route
                      path="/archive"
                      element={
                        <ProtectedShellRoute routeName="Archive" requiredRole="admin">
                            <ArchivePage />
                        </ProtectedShellRoute>
                      }
                    />

                    <Route
                      path="/profile"
                      element={
                        <ProtectedShellRoute routeName="Profile">
                            <ProfilePage />
                        </ProtectedShellRoute>
                      }
                    />

                    <Route
                      path="/settings"
                      element={
                        <ProtectedShellRoute routeName="Settings">
                            <SettingsPage />
                        </ProtectedShellRoute>
                      }
                    />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      )}
    </>
  );
};

export default App;
