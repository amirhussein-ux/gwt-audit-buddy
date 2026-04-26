import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MaturityRadarChart } from '@/components/dashboard/MaturityRadarChart';
import { ComplianceTrendChart } from '@/components/dashboard/ComplianceTrendChart';
import { AgencyLeaderboard } from '@/components/dashboard/AgencyLeaderboard';
import { CriticalAlertsTable } from '@/components/dashboard/CriticalAlertsTable';
import AuditInput from '@/components/AuditInput';
import AuditProgress, { type AuditStep as AuditProgressStep } from '@/components/AuditProgress';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { CheckCircle, Activity, BarChart3, FileText, ShieldCheck } from 'lucide-react';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

// Constants
const DASHBOARD_CONFIG = {
  STORAGE_KEYS: {
    LAST_AUDIT_RESULT: 'lastAuditResult',
    ACTIVE_AUDIT: 'activeAudit',
    AUDIT_STEPS: 'auditSteps',
    COMPLETED_AUDIT: 'completedAudit',
  },
  INITIAL_STATS: {
    totalAgencies: 0,
    averageCompliance: 0,
    totalAudits: 0,
    statusDistribution: { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 },
  },
};

const AUDIT_STEPS: Omit<AuditProgressStep, 'status'>[] = [
  { id: 'fetch', label: 'Fetching page content' },
  { id: 'pst', label: 'Checking Philippine Standard Time (PST)' },
  { id: 'transparency', label: 'Scanning for Transparency Seal' },
  { id: 'citizens', label: "Checking Citizen's Charter" },
  { id: 'masthead', label: 'Verifying masthead links (About Us, Contact Us, Home)' },
  { id: 'loadtime', label: 'Measuring website load time' },
  { id: 'alttags', label: 'Inspecting image ALT tags' },
  { id: 'urls', label: 'Validating descriptive URLs' },
  { id: 'fonts', label: 'Checking font sizes (12pt–14pt)' },
  { id: 'sns', label: 'Validating Social Networking Site links' },
  { id: 'presence', label: 'Scoring Web Presence stages' },
  { id: 'report', label: 'Generating audit report' },
];

interface CrawlOptions {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
}

interface AuditDataForDisplay {
  auditUrl: string;
  createdAt: string;
  pst?: { found: boolean };
  transparencySeal?: { found: boolean };
  performance?: { loadTimeMs: number };
  crawledPages?: Array<{ url: string }>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [lastAudit, setLastAudit] = useState<AuditDataForDisplay | null>(null);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [completedAuditId, setCompletedAuditId] = useState<string | null>(null);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [steps, setSteps] = useState<AuditProgressStep[]>(
    AUDIT_STEPS.map((step) => ({ ...step, status: 'pending' }))
  );
  const [dashboardStats, setDashboardStats] = useState({
    totalAgencies: 0,
    averageCompliance: 0,
    totalAudits: 0,
    statusDistribution: { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 },
  });
  const dashboardSettings = user?.settings?.dashboard;
  const auditDefaults = user?.settings?.auditDefaults;
  const systemOverviewStats = [
    {
      label: 'Total Agencies',
      value: dashboardStats.totalAgencies,
      accent: 'text-blue-600',
      background: 'bg-blue-50',
      icon: ShieldCheck,
    },
    {
      label: 'Avg Compliance',
      value: `${dashboardStats.averageCompliance}%`,
      accent: 'text-emerald-600',
      background: 'bg-emerald-50',
      icon: BarChart3,
    },
    {
      label: 'Total Audits',
      value: dashboardStats.totalAudits,
      accent: 'text-purple-600',
      background: 'bg-purple-50',
      icon: FileText,
    },
    {
      label: 'Critical Alerts',
      value: dashboardStats.statusDistribution.critical,
      accent: 'text-amber-600',
      background: 'bg-amber-50',
      icon: Activity,
    },
  ];

  // Check for recent audit result and active audit in progress
  useEffect(() => {
    const savedAudit = localStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.LAST_AUDIT_RESULT);
    if (savedAudit && location.pathname === '/dashboard') {
      try {
        setLastAudit(JSON.parse(savedAudit));
      } catch (e) {
        console.error('Failed to parse saved audit:', e);
      }
    }

    // Check if there's an active audit in progress
    const activeAudit = localStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
    if (activeAudit) {
      try {
        const auditData = JSON.parse(activeAudit);
        setActiveAuditId(auditData.auditLogId);
        setIsRunning(true);
        // Restore progress steps
        const savedSteps = localStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);
        if (savedSteps) {
          setSteps(JSON.parse(savedSteps));
        }
      } catch (e) {
        console.error('Failed to parse active audit:', e);
        localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
      }
    }
  }, [location.pathname]);

  // Global listener for completed audits (works across all pages, including same window)
  useEffect(() => {
    const handleAuditComplete = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.auditLogId) {
        setCompletedAuditId(customEvent.detail.auditLogId);
        setShowCompletionModal(true);
        console.log('[Dashboard] Audit completed, showing modal:', customEvent.detail.auditLogId);
      }
    };

    // Listen for custom audit completion event (works same window and cross-window)
    window.addEventListener('auditCompleted', handleAuditComplete);
    
    // Also listen for storage changes from other tabs/windows
    const handleStorageChange = () => {
      const completedAudit = localStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.COMPLETED_AUDIT);
      if (completedAudit) {
        try {
          const auditData = JSON.parse(completedAudit);
          setCompletedAuditId(auditData.auditLogId);
          setShowCompletionModal(true);
          console.log('[Dashboard] Audit completed (from other tab), showing modal:', auditData.auditLogId);
        } catch (e) {
          console.error('Failed to parse completed audit:', e);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('auditCompleted', handleAuditComplete);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleAuditStart = async (type: "url" | "file", data: string | File, options?: CrawlOptions) => {
    // Only handle URL audits for now
    if (type !== "url" || typeof data !== "string") {
      setAuditError("Only URL audits are supported");
      console.error("Only URL audits are supported");
      return;
    }

    const url = data;
    setAuditError(null);
    setIsRunning(true);
    setSteps((prev) => prev.map((s) => ({ ...s, status: s.id === 'fetch' ? 'running' : 'pending' })));

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      console.log('[Dashboard] Starting audit for:', url);
      
      const response = await fetch(`${API_BASE}/audit`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url, 
          maxPages: options?.maxPages || 20,
          maxDepth: options?.maxDepth || 3,
          concurrency: options?.concurrency || 3,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}: Audit failed`);
      }

      const responseData = await response.json();
      console.log('[Dashboard] Audit response:', responseData);

      // Audit is now in_progress mode
      // Mark initial steps as complete
      setSteps((prev) => prev.map((s) => (
        s.id === 'fetch' ? { ...s, status: 'done' } : s
      )));

      // Save active audit to localStorage so it persists across navigation
      localStorage.setItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT, JSON.stringify({
        auditLogId: responseData.auditLogId,
        startTime: Date.now(),
        url: url,
      }));

      // Update state so cancel button works
      setActiveAuditId(responseData.auditLogId);

      // Poll for completion before redirecting
      if (responseData.auditLogId) {
        console.log('[Dashboard] Polling for audit completion:', responseData.auditLogId);
      } else {
        throw new Error('No audit ID returned from server');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[Dashboard] Audit error:', errorMsg);
      setAuditError(errorMsg);
      setSteps((prev) =>
        prev.map((s) => (s.status === 'running' ? { ...s, status: 'failed' } : s))
      );
      setIsRunning(false);
      localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
    }
  };

  // Function to poll audit completion (extracted so it can be reused)
  const pollAuditCompletion = async (auditLogId: string, authToken: string, originalStartTime?: number) => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    let auditComplete = false;
    let pollCount = 0;
    let pollInterval = 1000; // Start at 1 second
    const maxPollInterval = 3000; // Max 3 seconds per poll
    const maxTotalTime = 600000; // 600 seconds max wait (10 minutes)
    let elapsedTime = 0;
    const startTime = originalStartTime || Date.now();
    
    while (!auditComplete && elapsedTime < maxTotalTime) {
      try {
        // Show progress with elapsed time
        const elapsedSeconds = Math.round(elapsedTime / 1000);
        console.log(`[Dashboard] Poll ${pollCount} (${elapsedSeconds}s): Checking audit status...`);
        
        const checkResponse = await fetch(`${API_BASE}/audit/${auditLogId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        
        if (checkResponse.ok) {
          const auditData = await checkResponse.json();
          const auditStatus = auditData.audit?.status;
          const pagesAudited = auditData.audit?.crawledPages?.length || 0;
          console.log(`[Dashboard] Poll ${pollCount}: status=${auditStatus}, pagesAudited=${pagesAudited}`);
          
          // Audit is complete when backend marks it as 'success'
          if (auditStatus === 'success') {
            auditComplete = true;
            console.log('[Dashboard] Audit complete! Data is ready.');
          } else if (auditStatus === 'failed') {
            throw new Error(auditData.audit?.error || 'Audit failed on server');
          } else if (auditStatus === 'cancelled') {
            console.log('[Dashboard] Audit was cancelled. Stopping polling.');
            // Clean up active audit state and keep the audit record as cancelled in backend.
            localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
            localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);
            setIsRunning(false);
            setActiveAuditId(null);
            setSteps(AUDIT_STEPS.map((step) => ({ ...step, status: 'pending' })));
            return;
          } else {
            // Still in progress - update progress display based on elapsed time
            const progressPercent = Math.min((elapsedTime / 60000) * 100, 95); // Max 95% while in progress
            const stepIndex = Math.floor((progressPercent / 100) * (AUDIT_STEPS.length - 1));
            
            setSteps((prev) => {
              const updated = prev.map((s, idx) => {
                if (idx < stepIndex) return { ...s, status: 'done' as const };
                if (idx === stepIndex) return { ...s, status: 'running' as const };
                return { ...s, status: 'pending' as const };
              });
              // Save steps to localStorage
              localStorage.setItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS, JSON.stringify(updated));
              return updated;
            });
          }
        }
        
        // Wait before next poll with exponential backoff
        pollCount++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        // Increase interval up to maxPollInterval
        pollInterval = Math.min(pollInterval + 500, maxPollInterval);
        
        elapsedTime = Date.now() - startTime;
      } catch (pollError) {
        console.error('[Dashboard] Poll error:', pollError);
        // Non-network terminal errors should stop polling immediately.
        if (
          pollError instanceof Error &&
          (pollError.message.includes('failed') || pollError.message.includes('cancelled'))
        ) {
          throw pollError;
        }
        // Otherwise continue polling on network errors
        elapsedTime = Date.now() - startTime;
        if (elapsedTime >= maxTotalTime) {
          throw new Error(`Audit polling timed out after ${Math.round(elapsedTime / 1000)}s`);
        }
      }
    }
    
    if (auditComplete) {
      console.log('[Dashboard] Audit complete! Saving completion state:', auditLogId);
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
      
      // Dispatch custom event for same-window popup
      window.dispatchEvent(new CustomEvent('auditCompleted', { 
        detail: { auditLogId: auditLogId } 
      }));
      
      // Save completed audit to localStorage to trigger modal in other tabs
      localStorage.setItem(DASHBOARD_CONFIG.STORAGE_KEYS.COMPLETED_AUDIT, JSON.stringify({
        auditLogId: auditLogId,
        completedAt: Date.now(),
      }));
      
      // Clean up active audit data
      localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
      localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);
      setIsRunning(false);
    } else {
      throw new Error(`Audit processing timed out after ${Math.round(elapsedTime / 1000)}s. Please try refreshing the page in a moment.`);
    }
  };

  // Resume polling if audit is already in progress when component mounts
  useEffect(() => {
    if (activeAuditId && token) {
      console.log('[Dashboard] Resuming poll for active audit:', activeAuditId);
      const resumePolling = async () => {
        try {
          // Get the original start time to calculate elapsed time correctly
          const activeAudit = localStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
          const originalStartTime = activeAudit ? JSON.parse(activeAudit).startTime : undefined;
          await pollAuditCompletion(activeAuditId, token, originalStartTime);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
          console.error('[Dashboard] Resume polling error:', errorMsg);
          setAuditError(errorMsg);
          setSteps((prev) =>
            prev.map((s) => (s.status === 'running' ? { ...s, status: 'failed' } : s))
          );
          setIsRunning(false);
          localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
          localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);
        }
      };
      resumePolling();
    }
  }, [activeAuditId, token]);

  // Fetch dashboard summary stats
  useEffect(() => {
    if (!token) return;

    const fetchDashboardStats = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const response = await fetch(`${API_BASE}/dashboard/summary`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setDashboardStats({
            totalAgencies: data.totalAgencies || 0,
            averageCompliance: parseFloat(data.averageCompliance) || 0,
            totalAudits: data.totalAudits || 0,
            statusDistribution: data.statusDistribution || { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 },
          });
        }
      } catch (error) {
        console.error('[Dashboard] Failed to fetch summary stats:', error);
      }
    };

    // Fetch immediately on mount
    fetchDashboardStats();

    // Refetch every 30 seconds
    const interval = setInterval(fetchDashboardStats, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // Handle completion modal actions
  const handleViewResults = () => {
    if (completedAuditId) {
      localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.COMPLETED_AUDIT);
      setShowCompletionModal(false);
      navigate(`/audit/${completedAuditId}`);
    }
  };

  const handleStayOnPage = () => {
    localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.COMPLETED_AUDIT);
    setShowCompletionModal(false);
  };

  const handleCancelAuditClick = () => {
    setCancelConfirmationOpen(true);
  };

  const handleCancelAuditConfirm = async () => {
    if (!activeAuditId) {
      console.error('[Dashboard] Cannot cancel: No active audit ID');
      setAuditError('No active audit to cancel');
      setCancelConfirmationOpen(false);
      return;
    }
    if (!token) {
      console.error('[Dashboard] Cannot cancel: No authentication token');
      setAuditError('Authentication token missing');
      setCancelConfirmationOpen(false);
      return;
    }

    setIsCancelling(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      console.log('[Dashboard] Cancelling audit:', {
        auditId: activeAuditId,
        apiBase: API_BASE,
      });

      const response = await fetch(`${API_BASE}/audit/${activeAuditId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('[Dashboard] Cancel response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errorMsg = error.error || `Server error: ${response.status}`;
        console.error('[Dashboard] Cancel failed:', errorMsg);
        throw new Error(errorMsg);
      }

      const result = await response.json();
      console.log('[Dashboard] Audit cancelled successfully:', result);
      setIsRunning(false);
      setActiveAuditId(null);
      setAuditError(null);
      setCancelConfirmationOpen(false);
      
      // Clear from localStorage
      localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
      localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);

      // Reset steps
      setSteps(AUDIT_STEPS.map((step) => ({ ...step, status: 'pending' })));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to cancel audit';
      console.error('[Dashboard] Error cancelling audit:', errorMsg);
      setAuditError(`Cancel failed: ${errorMsg}`);
      setCancelConfirmationOpen(false);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div
      className={cn(
        "min-h-full space-y-8 py-8",
        brandColors.appShell.contentPadding,
      )}
    >
      {/* Audit Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
          <Card className={cn("mx-4 w-full max-w-md border-green-200 bg-white shadow-lg", brandColors.surfaces.primaryCard)}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <CardTitle className="text-white">Audit Complete!</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-white text-slate-700 ">
                Your audit has been successfully completed and the results are ready to view.
              </p>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleViewResults}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  View Results
                </Button>
                <Button
                  onClick={handleStayOnPage}
                  variant="outline"
                  className="flex-1 text-black hover:bg-slate-800 hover:text-white"
                >
                  Stay on Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <section className="space-y-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-800">Audit Dashboard</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Start a new compliance run, monitor live progress, and review the latest operational
            signals across MASID.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mx-auto w-full max-w-3xl xl:mx-0 xl:max-w-none">
            <Card
              className={cn(
                brandColors.surfaces.heroCard,
                "relative overflow-hidden"
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(216,180,254,0.30),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.24),transparent_30%)]" />
              <CardHeader className="relative space-y-3 pb-4">
                <div className="inline-flex w-fit items-center roun
                ded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-medium text-violet-700 shadow-sm">
                  Primary action
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl text-slate-900">Run New Audit</CardTitle>
                  <CardDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                    Launch a fresh compliance assessment for a Philippine government website and
                    keep the scan status in view as the audit progresses.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="relative space-y-5">
                {auditError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-800">
                      <strong>Error:</strong> {auditError}
                    </p>
                  </div>
                )}

                {!isRunning ? (
                  <AuditInput
                    onStartAudit={handleAuditStart}
                    isAuditing={isRunning}
                    initialOptions={auditDefaults}
                  />
                ) : (
                  <div className="space-y-4 rounded-[26px] border border-white/70 bg-white/75 p-5 shadow-[0_16px_36px_rgba(148,163,184,0.10)] backdrop-blur-md">
                    <AuditProgress steps={steps} isVisible={isRunning} />
                    <div className="flex flex-col gap-3 border-t border-slate-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-600">
                        Audit in progress. You will receive a notification when the report is ready.
                      </p>
                      <Button
                        onClick={handleCancelAuditClick}
                        variant="destructive"
                        className="whitespace-nowrap"
                      >
                        Cancel Audit
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="xl:col-span-1">
          <Card className={cn(brandColors.surfaces.dashboardCard, "bg-white/68")}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-slate-900">System Overview</CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Quick operational metrics for the current audit workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
                {systemOverviewStats.map((stat) => (
                  <div
                    key={stat.label}
                    className={cn(
                      brandColors.surfaces.statCard,
                      "p-4",
                      stat.background
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <stat.icon className={cn("h-4 w-4", stat.accent)} />
                      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                        Live
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                    <p className={cn("mt-2 text-2xl font-semibold tracking-tight", stat.accent)}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-800">Insights</h2>
          <p className="text-sm text-slate-500">
            Trend and maturity views stay available, but the audit workflow remains the lead action.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {dashboardSettings?.showTrendChart !== false && (
          <div className="lg:col-span-2">
            <ComplianceTrendChart />
          </div>
        )}

        <div className={dashboardSettings?.showTrendChart === false ? 'lg:col-span-3' : ''}>
          <MaturityRadarChart />
        </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-800">Operational Detail</h2>
          <p className="text-sm text-slate-500">
            Supporting tables and ranked views remain accessible below the primary audit surface.
          </p>
        </div>

        <div className="space-y-6">
          {dashboardSettings?.showAgencyLeaderboard !== false && <AgencyLeaderboard />}

          {dashboardSettings?.showCriticalAlerts !== false && <CriticalAlertsTable />}
        </div>
      </section>

      {/* Cancel Audit Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={cancelConfirmationOpen}
        title="Cancel this audit?"
        description="Stopping this audit will halt the scanning process and discard the current progress. You can start a new audit anytime."
        confirmText="Cancel Audit"
        cancelText="Keep Running"
        variant="danger"
        isLoading={isCancelling}
        onConfirm={handleCancelAuditConfirm}
        onCancel={() => setCancelConfirmationOpen(false)}
      />
    </div>
  );
}
