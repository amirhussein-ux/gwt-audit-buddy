import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import AuditInput from '@/components/AuditInput';
import AuditProgress, { type AuditStep as AuditProgressStep } from '@/components/AuditProgress';
import AuditCompletionModal from '@/components/AuditCompletionModal';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { WidgetErrorBoundary } from '@/components/error-boundaries/WidgetErrorBoundary';
import { InfoBubble } from '@/components/InfoBubble';
import { MultiSelectToolbar } from '@/components/MultiSelectToolbar';
import { exportDashboardSectionsToPdf } from '@/utils/dashboardPdfExport';
import { Activity, BarChart3, FileText, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';
import { parseDashboardSummary } from '@/lib/parsers/parseDashboardSummary';
import type { DashboardStats } from '@/lib/validation/dashboardSchemas';
import { CardSkeleton, ChartSkeleton, ErrorState } from '@/components/states';

const MaturityRadarChart = lazy(() =>
  import('@/components/dashboard/MaturityRadarChart').then((module) => ({
    default: module.MaturityRadarChart,
  }))
);
const ComplianceTrendChart = lazy(() =>
  import('@/components/dashboard/ComplianceTrendChart').then((module) => ({
    default: module.ComplianceTrendChart,
  }))
);
const AgencyLeaderboard = lazy(() =>
  import('@/components/dashboard/AgencyLeaderboard').then((module) => ({
    default: module.AgencyLeaderboard,
  }))
);
const CriticalAlertsTable = lazy(() =>
  import('@/components/dashboard/CriticalAlertsTable').then((module) => ({
    default: module.CriticalAlertsTable,
  }))
);

const DASHBOARD_CONFIG = {
  STORAGE_KEYS: {
    ACTIVE_AUDIT: 'activeAudit',
    AUDIT_STEPS: 'auditSteps',
    COMPLETED_AUDIT: 'completedAudit',
  },
  AUDIT_POLLING: {
    MAX_TOTAL_TIME_MS: 2 * 60 * 60 * 1000,
    INITIAL_INTERVAL_MS: 3000,
    MAX_INTERVAL_MS: 10000,
    CANCELLATION_INTERVAL_MS: 2000,
    STEP_ADVANCE_MS: 15000,
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
  { id: 'fonts', label: 'Checking font sizes (12pt-14pt)' },
  { id: 'sns', label: 'Validating Social Networking Site links' },
  { id: 'presence', label: 'Scoring Web Presence stages' },
  { id: 'report', label: 'Generating audit report' },
];

interface CrawlOptions {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
}

interface AuditStatusResponse {
  audit?: {
    status?: string;
    crawledPages?: Array<{ url: string }>;
    cancellation?: {
      requestedAt?: string | null;
      completedAt?: string | null;
    };
    error?: string;
  };
}

type CancellationState = 'idle' | 'in_progress' | 'complete';

const DEFAULT_DASHBOARD_STATS: DashboardStats = {
  totalAgencies: 0,
  averageCompliance: 0,
  totalAudits: 0,
  statusDistribution: { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 },
};

const parseStoredJson = <T,>(rawValue: string | null, fallback: T): T => {
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Dashboard] Failed to parse stored JSON:', error);
    }
    return fallback;
  }
};

function DashboardReportSkeleton({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className={cn(brandColors.surfaces.dashboardCard, 'bg-white/70')}>
      <CardHeader>
        <CardTitle className="text-base font-bold">{title}</CardTitle>
        <CardDescription className="mt-1 text-xs leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-violet-600" />
          <p className="text-sm">Loading report…</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const { toast } = useToast();
  const reportRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [isRunning, setIsRunning] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [completedAuditId, setCompletedAuditId] = useState<string | null>(null);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [cancellationState, setCancellationState] = useState<CancellationState>('idle');
  const cancellationStateRef = useRef<CancellationState>('idle');
  const [reportSelectionEnabled, setReportSelectionEnabled] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [isExportingReports, setIsExportingReports] = useState(false);
  const auditPollingAbortRef = useRef<AbortController | null>(null);
  const lastProgressStepRef = useRef<number>(0);
  const [steps, setSteps] = useState<AuditProgressStep[]>(
    AUDIT_STEPS.map((step) => ({ ...step, status: 'pending' }))
  );

  const dashboardSettings = user?.settings?.dashboard;
  const auditDefaults = user?.settings?.auditDefaults;
  const {
    data: dashboardStats = DEFAULT_DASHBOARD_STATS,
    isLoading: isDashboardStatsLoading,
    error: dashboardStatsError,
    refetch: refetchDashboardStats,
    isFetching: isDashboardStatsFetching,
  } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async (): Promise<DashboardStats> => {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const response = await fetch(`${API_BASE}/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to fetch dashboard summary');
      }

      const data = await response.json().catch(() => null);
      const parsed = parseDashboardSummary(data);
      if (parsed.ok) {
        return parsed.data;
      }
      throw new Error((parsed as { ok: false; error: string }).error);
    },
    enabled: !!token,
    refetchInterval: isRunning ? false : 30000,
    refetchOnWindowFocus: false,
  });

  const systemOverviewStats = [
    {
      label: 'Total Agencies',
      value: dashboardStats.totalAgencies,
      accent: 'text-blue-600',
      background: 'bg-blue-50',
      icon: ShieldCheck,
      summary: 'The number of active agencies currently tracked in the audit workspace.',
    },
    {
      label: 'Avg Compliance',
      value: `${dashboardStats.averageCompliance}%`,
      accent: 'text-emerald-600',
      background: 'bg-emerald-50',
      icon: BarChart3,
      summary: 'The average compliance score across the current audit dataset.',
    },
    {
      label: 'Total Audits',
      value: dashboardStats.totalAudits,
      accent: 'text-purple-600',
      background: 'bg-purple-50',
      icon: FileText,
      summary: 'The cumulative number of audit runs recorded in the system.',
    },
    {
      label: 'Critical Alerts',
      value: dashboardStats.statusDistribution.critical,
      accent: 'text-amber-600',
      background: 'bg-amber-50',
      icon: Activity,
      summary: 'The number of agencies currently flagged with critical compliance concerns.',
    },
  ];

  useEffect(() => {
    const activeAudit = sessionStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
    if (!activeAudit || location.pathname !== '/dashboard') return;

    const auditData = parseStoredJson<{ auditLogId?: string } | null>(activeAudit, null);
    if (!auditData?.auditLogId) {
      sessionStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
      return;
    }

    setActiveAuditId(auditData.auditLogId);
    setIsRunning(true);

    const savedSteps = parseStoredJson<AuditProgressStep[] | null>(
      sessionStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS),
      null
    );

    if (Array.isArray(savedSteps) && savedSteps.length > 0) {
      setSteps(savedSteps);
    }
  }, [location.pathname]);

  /**
   * Resume in-progress audits after login
   * When user logs back in, check API for any in-progress audits and resume them
   */
  useEffect(() => {
    const resumeInProgressAudit = async () => {
      // Only run if: user is authenticated, on dashboard, and no active audit in sessionStorage
      if (!token || !user || location.pathname !== '/dashboard' || activeAuditId) return;

      const activeAudit = sessionStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
      if (activeAudit) {
        // Already loaded from sessionStorage in previous effect
        return;
      }

      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const response = await fetch(`${API_BASE}/audit?status=in_progress&limit=1`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('[Dashboard] Failed to fetch in-progress audits:', response.status);
          return;
        }

        const data = await response.json();
        const audits = data.audits || [];

        // If user has an in-progress audit, resume it
        if (audits.length > 0) {
          const inProgressAudit = audits[0];
          const auditData = {
            auditLogId: inProgressAudit._id,
            url: inProgressAudit.auditUrl,
            status: inProgressAudit.status,
          };

          sessionStorage.setItem(
            DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT,
            JSON.stringify(auditData)
          );

          setActiveAuditId(inProgressAudit._id);
          setIsRunning(true);

          console.log('[Dashboard] Resumed in-progress audit:', inProgressAudit._id);
        }
      } catch (error) {
        console.error('[Dashboard] Error resuming audit:', error);
        // Silently fail - don't block dashboard from loading
      }
    };

    resumeInProgressAudit();
  }, [token, user, location.pathname, activeAuditId]);

  useEffect(() => {
    const loadCompletedAudit = () => {
      const completedAudit = sessionStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.COMPLETED_AUDIT);
      if (!completedAudit) return;

      const auditData = parseStoredJson<{ auditLogId?: string } | null>(completedAudit, null);
      if (auditData?.auditLogId) {
        setCompletedAuditId(auditData.auditLogId);
        setShowCompletionModal(true);
      }
    };

    const handleAuditComplete = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.auditLogId) {
        setCompletedAuditId(customEvent.detail.auditLogId);
        setShowCompletionModal(true);
      }
    };

    window.addEventListener('auditCompleted', handleAuditComplete);
    loadCompletedAudit();
    return () => {
      window.removeEventListener('auditCompleted', handleAuditComplete);
    };
  }, []);

  const visibleReports = useMemo(() => {
    const reports = [
      {
        id: 'compliance-trend',
        title: 'Compliance Trend Report',
        description: 'Performance tracking across all agencies.',
        visible: dashboardSettings?.showTrendChart !== false,
        className: 'lg:col-span-2',
        content: (
          <WidgetErrorBoundary
            title="Compliance Trend Report"
            description="Performance tracking across all agencies."
          >
            <Suspense
              fallback={
                <ChartSkeleton
                  title="Compliance Trend Report"
                  description="Performance tracking across all agencies."
                />
              }
            >
              <ComplianceTrendChart />
            </Suspense>
          </WidgetErrorBoundary>
        ),
      },
      {
        id: 'maturity-index',
        title: 'Maturity Index',
        description: 'Overall compliance maturity snapshot.',
        visible: true,
        className: dashboardSettings?.showTrendChart === false ? 'lg:col-span-3' : '',
        content: (
          <WidgetErrorBoundary
            title="Maturity Index"
            description="Overall compliance maturity snapshot."
          >
            <Suspense
              fallback={
                <ChartSkeleton
                  title="Maturity Index"
                  description="Overall compliance maturity snapshot."
                />
              }
            >
              <MaturityRadarChart />
            </Suspense>
          </WidgetErrorBoundary>
        ),
      },
      {
        id: 'agency-leaderboard',
        title: 'Top Agencies',
        description: 'Comparative performance rankings and insights.',
        visible: dashboardSettings?.showAgencyLeaderboard !== false,
        className: '',
        content: (
          <WidgetErrorBoundary
            title="Top Agencies"
            description="Comparative performance rankings and insights."
          >
            <Suspense
              fallback={
                <CardSkeleton
                  title="Top Agencies"
                  description="Comparative performance rankings and insights."
                  variant="list"
                />
              }
            >
              <AgencyLeaderboard />
            </Suspense>
          </WidgetErrorBoundary>
        ),
      },
      {
        id: 'critical-alerts',
        title: 'Critical Alerts',
        description: 'Priority agencies that need attention now.',
        visible: dashboardSettings?.showCriticalAlerts !== false,
        className: '',
        content: (
          <WidgetErrorBoundary
            title="Critical Alerts"
            description="Priority agencies that need attention now."
          >
            <Suspense
              fallback={
                <CardSkeleton
                  title="Critical Alerts"
                  description="Priority agencies that need attention now."
                  variant="list"
                />
              }
            >
              <CriticalAlertsTable />
            </Suspense>
          </WidgetErrorBoundary>
        ),
      },
    ];

    return reports.filter((report) => report.visible);
  }, [dashboardSettings?.showAgencyLeaderboard, dashboardSettings?.showCriticalAlerts, dashboardSettings?.showTrendChart]);

  const setCancellationStateSynced = (state: CancellationState) => {
    cancellationStateRef.current = state;
    setCancellationState(state);
  };

  const finalizeCancelledAuditUi = () => {
    auditPollingAbortRef.current?.abort();
    sessionStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
    sessionStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);
    setActiveAuditId(null);
    setTimeout(() => {
      setIsRunning(false);
      setSteps(AUDIT_STEPS.map((step) => ({ ...step, status: 'pending' })));
      setCancellationStateSynced('idle');
      lastProgressStepRef.current = 0;
    }, 2200);
  };

  const handleAuditStart = async (type: 'url' | 'file', data: string | File, options?: CrawlOptions) => {
    if (type !== 'url' || typeof data !== 'string') {
      setAuditError('Only URL audits are supported');
      return;
    }

    const url = data;
    setAuditError(null);
    setCancellationStateSynced('idle');
    setIsRunning(true);
    lastProgressStepRef.current = 0;
    setSteps((prev) => prev.map((step) => ({ ...step, status: step.id === 'fetch' ? 'running' : 'pending' })));

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const response = await fetch(`${API_BASE}/audit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          maxPages: options?.maxPages || 20,
          maxDepth: options?.maxDepth || 3,
          concurrency: options?.concurrency || 3,
        }),
      });

      if (response.status === 409) {
        const conflict = await response.json().catch(() => ({}));
        const conflictAuditId = conflict?.auditLogId;

        if (conflictAuditId) {
          sessionStorage.setItem(
            DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT,
            JSON.stringify({
              auditLogId: conflictAuditId,
              startTime: Date.now(),
              url,
            })
          );

          setActiveAuditId(conflictAuditId);
          setIsRunning(true);
          return;
        }

        throw new Error(conflict?.error || 'An audit is already in progress.');
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}: Audit failed`);
      }

      const responseData = await response.json();
      setSteps((prev) => prev.map((step) => (step.id === 'fetch' ? { ...step, status: 'done' } : step)));

      sessionStorage.setItem(
        DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT,
        JSON.stringify({
          auditLogId: responseData.auditLogId,
          startTime: Date.now(),
          url,
        })
      );

      setActiveAuditId(responseData.auditLogId);
    } catch (startError) {
      const errorMsg = startError instanceof Error ? startError.message : 'Unknown error occurred';
      setAuditError(errorMsg);
      setSteps((prev) => prev.map((step) => (step.status === 'running' ? { ...step, status: 'failed' } : step)));
      setIsRunning(false);
      sessionStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
    }
  };

  const pollAuditCompletion = async (auditLogId: string, authToken: string, originalStartTime?: number) => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    auditPollingAbortRef.current?.abort();
    const controller = new AbortController();
    auditPollingAbortRef.current = controller;
    let auditComplete = false;
    let pollInterval = DASHBOARD_CONFIG.AUDIT_POLLING.INITIAL_INTERVAL_MS;
    const maxPollInterval = DASHBOARD_CONFIG.AUDIT_POLLING.MAX_INTERVAL_MS;
    const maxTotalTime = DASHBOARD_CONFIG.AUDIT_POLLING.MAX_TOTAL_TIME_MS;
    let elapsedTime = 0;
    const startTime = originalStartTime || Date.now();

    const updateProgressSteps = (nextIndex: number) => {
      const clampedIndex = Math.max(0, Math.min(nextIndex, AUDIT_STEPS.length - 1));
      if (clampedIndex === lastProgressStepRef.current) {
        return;
      }

      lastProgressStepRef.current = clampedIndex;
      setSteps((prev) => {
        const updated = prev.map((step, idx) => {
          if (idx < clampedIndex) return { ...step, status: 'done' as const };
          if (idx === clampedIndex) return { ...step, status: 'running' as const };
          return { ...step, status: 'pending' as const };
        });
        sessionStorage.setItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS, JSON.stringify(updated));
        return updated;
      });
    };

    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => resolve(), ms);
        controller.signal.addEventListener(
          'abort',
          () => {
            window.clearTimeout(timeoutId);
            reject(new Error('Audit polling aborted'));
          },
          { once: true }
        );
      });

    while (!auditComplete && elapsedTime < maxTotalTime) {
      if (controller.signal.aborted) {
        return;
      }

      try {
        const checkResponse = await fetch(`${API_BASE}/audit/${auditLogId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
          cache: 'no-store',
          signal: controller.signal,
        });

        if (checkResponse.ok) {
          const auditData = (await checkResponse.json()) as AuditStatusResponse;
          const auditStatus = auditData.audit?.status;
          const isCancellationPending = Boolean(
            auditData.audit?.cancellation?.requestedAt && !auditData.audit?.cancellation?.completedAt
          );

          if (isCancellationPending) {
            setCancellationStateSynced('in_progress');
          } else if (cancellationStateRef.current === 'in_progress') {
            setCancellationStateSynced('idle');
          }

          if (auditStatus === 'success' || auditStatus === 'partial') {
            auditComplete = true;
            setCancellationStateSynced('idle');
            if (auditStatus === 'partial') {
              toast({
                title: 'Audit completed with partial results',
                description:
                  'The audit finished, but some pages or checks could not be collected. You can still review the available results.',
              });
            }
          } else if (auditStatus === 'failed') {
            const failureMessage = auditData.audit?.error || 'Audit failed on server';
            setAuditError(failureMessage);
            setSteps((prev) => prev.map((step) => (step.status === 'running' ? { ...step, status: 'failed' } : step)));
            auditComplete = true;
            setIsRunning(false);
            setCancellationStateSynced('idle');
            sessionStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
            sessionStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);
            return;
          } else if (auditStatus === 'cancelled') {
            setCancellationStateSynced('complete');
            finalizeCancelledAuditUi();
            return;
          } else {
            const stepIndex = Math.min(
              Math.floor(elapsedTime / DASHBOARD_CONFIG.AUDIT_POLLING.STEP_ADVANCE_MS),
              AUDIT_STEPS.length - 1
            );
            updateProgressSteps(stepIndex);
          }
        }

        const currentInterval = isCancellationPending
          ? DASHBOARD_CONFIG.AUDIT_POLLING.CANCELLATION_INTERVAL_MS
          : pollInterval;

        await wait(currentInterval);

        if (!isCancellationPending) {
          pollInterval = Math.min(pollInterval + 500, maxPollInterval);
        }
        elapsedTime = Date.now() - startTime;
      } catch (pollError) {
        if (controller.signal.aborted) {
          return;
        }

        if (
          pollError instanceof Error &&
          (pollError.message.includes('failed') || pollError.message.includes('cancelled'))
        ) {
          throw pollError;
        }

        elapsedTime = Date.now() - startTime;
        if (elapsedTime >= maxTotalTime) {
          throw new Error(`Audit polling timed out after ${Math.round(elapsedTime / 1000)}s`);
        }
      }
    }

    if (!auditComplete) {
      throw new Error(`Audit processing timed out after ${Math.round(elapsedTime / 1000)}s. Please try refreshing the page in a moment.`);
    }

    setSteps((prev) => prev.map((step) => ({ ...step, status: 'done' })));
    window.dispatchEvent(new CustomEvent('auditCompleted', { detail: { auditLogId } }));
    sessionStorage.setItem(
      DASHBOARD_CONFIG.STORAGE_KEYS.COMPLETED_AUDIT,
      JSON.stringify({
        auditLogId,
        completedAt: Date.now(),
      })
    );
    sessionStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
    sessionStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);
    setIsRunning(false);
    setCancellationStateSynced('idle');
    lastProgressStepRef.current = AUDIT_STEPS.length - 1;
  };

  useEffect(() => {
    if (!activeAuditId || !token) return;

    const resumePolling = async () => {
      try {
        const activeAudit = sessionStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
        const originalStartTime = parseStoredJson<{ startTime?: number } | null>(activeAudit, null)?.startTime;
        await pollAuditCompletion(activeAuditId, token, originalStartTime);
      } catch (pollError) {
        const errorMsg = pollError instanceof Error ? pollError.message : 'Unknown error occurred';
        setAuditError(errorMsg);
        setSteps((prev) => prev.map((step) => (step.status === 'running' ? { ...step, status: 'failed' } : step)));
        setIsRunning(false);
        setCancellationStateSynced('idle');
        sessionStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
        sessionStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);
      }
    };

    resumePolling();
    return () => {
      auditPollingAbortRef.current?.abort();
    };
  }, [activeAuditId, token]);

  const handleViewResults = () => {
    if (!completedAuditId) return;
    sessionStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.COMPLETED_AUDIT);
    setShowCompletionModal(false);
    navigate(`/audit/${completedAuditId}`);
  };

  const handleStayOnPage = () => {
    sessionStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.COMPLETED_AUDIT);
    setShowCompletionModal(false);
  };

  const handleCancelAuditConfirm = async () => {
    if (!activeAuditId || !token) {
      setAuditError('No active audit to cancel');
      setCancelConfirmationOpen(false);
      return;
    }

    setIsCancelling(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
      const response = await fetch(`${API_BASE}/audit/${activeAuditId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Server error: ${response.status}`);
      }

      setCancelConfirmationOpen(false);
      const responseData = await response.json().catch(() => ({}));
      const cancelledStatus = responseData?.audit?.status;

      if (cancelledStatus === 'in_progress' || responseData?.message?.includes('in progress')) {
        setCancellationStateSynced('in_progress');
        setAuditError(null);
      } else {
        setCancellationStateSynced('idle');
        if (cancelledStatus && cancelledStatus !== 'cancelled') {
          setAuditError(`Audit already finished with status: ${cancelledStatus}`);
        } else {
          setAuditError(null);
        }
      }
    } catch (cancelError) {
      const errorMsg = cancelError instanceof Error ? cancelError.message : 'Failed to cancel audit';
      setAuditError(`Cancel failed: ${errorMsg}`);
      setCancelConfirmationOpen(false);
    } finally {
      setIsCancelling(false);
    }
  };

  const toggleSelectedReport = (reportId: string) => {
    setSelectedReportIds((prev) =>
      prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId]
    );
  };

  const handleExportSelectedReports = async () => {
    if (selectedReportIds.length === 0) return;

    try {
      setIsExportingReports(true);
      const sections = selectedReportIds
        .map((reportId) => {
          const report = visibleReports.find((item) => item.id === reportId);
          const element = reportRefs.current[reportId];
          if (!report || !element) return null;
          return {
            title: report.title,
            description: report.description,
            element,
          };
        })
        .filter(Boolean);

      await exportDashboardSectionsToPdf(
        sections as Array<{ title: string; description?: string; element: HTMLElement }>,
        `dashboard-reports-${new Date().toISOString().split('T')[0]}.pdf`
      );
    } catch (exportError) {
      console.error('Failed to export dashboard reports:', exportError);
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'The selected dashboard reports could not be exported. Please try again.',
      });
    } finally {
      setIsExportingReports(false);
    }
  };

  return (
    <div className={cn('min-h-full space-y-8 py-8', brandColors.appShell.contentPadding)}>
      <AuditCompletionModal
        isOpen={showCompletionModal}
        onViewResults={handleViewResults}
        onStayOnPage={handleStayOnPage}
      />

      <section>
        <div className="w-full">
          <Card className={cn(brandColors.surfaces.heroCard, 'relative overflow-hidden')}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(216,180,254,0.30),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(191,219,254,0.24),transparent_30%)]" />
            <CardHeader className="relative space-y-3 pb-4">
              <div className="inline-flex w-fit items-center rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-medium text-violet-700 shadow-sm">
                Primary action
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl text-slate-900">Run New Audit</CardTitle>
                <CardDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                  Launch a fresh compliance assessment for a Philippine government website and keep the scan status in view as the audit progresses.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-5">
              {auditError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-800">
                    <strong>Error:</strong> {auditError}
                  </p>
                </div>
              ) : null}

              {!isRunning || cancellationState !== 'idle' ? (
                <AuditInput
                  onStartAudit={handleAuditStart}
                  isAuditing={isRunning}
                  cancellationState={cancellationState}
                  initialOptions={auditDefaults}
                />
              ) : (
                <div className="space-y-4 rounded-[26px] border border-white/70 bg-white/75 p-5 shadow-[0_16px_36px_rgba(148,163,184,0.10)] backdrop-blur-md">
                  <AuditProgress steps={steps} isVisible={isRunning} />
                  <div className="flex flex-col gap-3 border-t border-slate-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600">
                      Audit in progress. You will receive a notification when the report is ready.
                    </p>
                    <Button onClick={() => setCancelConfirmationOpen(true)} variant="destructive" className="whitespace-nowrap">
                      Cancel Audit
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-8">
        {isDashboardStatsLoading ? (
          <CardSkeleton
            title="System Overview"
            description="Quick operational metrics for the current audit workspace."
            variant="stats"
          />
        ) : dashboardStatsError ? (
          <ErrorState
            title="System overview is unavailable"
            description={
              dashboardStatsError instanceof Error
                ? dashboardStatsError.message
                : 'The dashboard summary could not be loaded right now.'
            }
            onRetry={() => void refetchDashboardStats()}
            retryLabel={isDashboardStatsFetching ? 'Retrying...' : 'Retry summary'}
            isRetrying={isDashboardStatsFetching}
          />
        ) : (
          <Card className={cn(brandColors.surfaces.dashboardCard, 'bg-white/68')}>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg text-slate-900">System Overview</CardTitle>
                  <CardDescription className="text-sm text-slate-500">
                    Quick operational metrics for the current audit workspace.
                  </CardDescription>
                </div>
                <div data-export-ignore="true">
                  <InfoBubble
                    title="System Overview"
                    summary="These summary cards give you a fast operational read of the current workspace."
                    sections={[
                      { title: 'How to use it', body: 'Use these values for quick orientation, then move into the detailed report cards below for trend and issue context.' },
                    ]}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
                {systemOverviewStats.map((stat) => (
                  <div key={stat.label} className={cn(brandColors.surfaces.statCard, 'p-4', stat.background)}>
                    <div className="mb-3 flex items-center justify-between">
                      <stat.icon className={cn('h-4 w-4', stat.accent)} />
                      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Live</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                        <p className={cn('mt-2 text-2xl font-semibold tracking-tight', stat.accent)}>{stat.value}</p>
                      </div>
                      <div data-export-ignore="true">
                        <InfoBubble title={stat.label} summary={stat.summary} className="h-7 px-2.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-800">Insights</h2>
          <p className="text-sm text-slate-500">
            Trend and maturity views stay available, but the audit workflow remains the lead action.
          </p>
        </div>

        <MultiSelectToolbar
          title="Dashboard Report Export"
          selectedCount={selectedReportIds.length}
          totalCount={visibleReports.length}
          selectionEnabled={reportSelectionEnabled}
          isBusy={isExportingReports}
          onToggleSelection={() => {
            setReportSelectionEnabled((prev) => !prev);
            if (reportSelectionEnabled) {
              setSelectedReportIds([]);
            }
          }}
          onSelectAll={() => setSelectedReportIds(visibleReports.map((report) => report.id))}
          onClear={() => setSelectedReportIds([])}
          primaryActionLabel="Export Selected Reports"
          onPrimaryAction={handleExportSelectedReports}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {visibleReports
            .filter((report) => report.id === 'compliance-trend' || report.id === 'maturity-index')
            .map((report) => {
              const isSelected = selectedReportIds.includes(report.id);
              return (
                <div
                  key={report.id}
                  ref={(element) => {
                    reportRefs.current[report.id] = element;
                  }}
                  className={cn('relative', report.className, isSelected && 'rounded-[28px] ring-2 ring-violet-300')}
                >
                  {reportSelectionEnabled ? (
                    <div className="absolute right-4 top-4 z-10 rounded-full bg-white/95 p-2 shadow-sm" data-export-ignore="true">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectedReport(report.id)} />
                    </div>
                  ) : null}
                  {report.content}
                </div>
              );
            })}
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
          {visibleReports
            .filter((report) => report.id === 'agency-leaderboard' || report.id === 'critical-alerts')
            .map((report) => {
              const isSelected = selectedReportIds.includes(report.id);
              return (
                <div
                  key={report.id}
                  ref={(element) => {
                    reportRefs.current[report.id] = element;
                  }}
                  className={cn('relative', isSelected && 'rounded-[28px] ring-2 ring-violet-300')}
                >
                  {reportSelectionEnabled ? (
                    <div className="absolute right-4 top-4 z-10 rounded-full bg-white/95 p-2 shadow-sm" data-export-ignore="true">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectedReport(report.id)} />
                    </div>
                  ) : null}
                  {report.content}
                </div>
              );
            })}
        </div>
      </section>

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
