import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { MaturityRadarChart } from '@/components/dashboard/MaturityRadarChart';
import { ComplianceTrendChart } from '@/components/dashboard/ComplianceTrendChart';
import { AgencyLeaderboard } from '@/components/dashboard/AgencyLeaderboard';
import { CriticalAlertsTable } from '@/components/dashboard/CriticalAlertsTable';
import AuditInput from '@/components/AuditInput';
import AuditProgress, { type AuditStep as AuditProgressStep } from '@/components/AuditProgress';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { InfoBubble } from '@/components/InfoBubble';
import { MultiSelectToolbar } from '@/components/MultiSelectToolbar';
import { exportDashboardSectionsToPdf } from '@/utils/dashboardPdfExport';
import { CheckCircle, Activity, BarChart3, FileText, ShieldCheck } from 'lucide-react';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

const DASHBOARD_CONFIG = {
  STORAGE_KEYS: {
    ACTIVE_AUDIT: 'activeAudit',
    AUDIT_STEPS: 'auditSteps',
    COMPLETED_AUDIT: 'completedAudit',
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

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const reportRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [isRunning, setIsRunning] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [completedAuditId, setCompletedAuditId] = useState<string | null>(null);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [cancellationState, setCancellationState] = useState<CancellationState>('idle');
  const [reportSelectionEnabled, setReportSelectionEnabled] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [isExportingReports, setIsExportingReports] = useState(false);
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
    const activeAudit = localStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
    if (!activeAudit || location.pathname !== '/dashboard') return;

    try {
      const auditData = JSON.parse(activeAudit);
      setActiveAuditId(auditData.auditLogId);
      setIsRunning(true);
      const savedSteps = localStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);
      if (savedSteps) {
        setSteps(JSON.parse(savedSteps));
      }
    } catch (parseError) {
      console.error('Failed to parse active audit:', parseError);
      localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleAuditComplete = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.auditLogId) {
        setCompletedAuditId(customEvent.detail.auditLogId);
        setShowCompletionModal(true);
      }
    };

    window.addEventListener('auditCompleted', handleAuditComplete);

    const handleStorageChange = () => {
      const completedAudit = localStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.COMPLETED_AUDIT);
      if (!completedAudit) return;

      try {
        const auditData = JSON.parse(completedAudit);
        setCompletedAuditId(auditData.auditLogId);
        setShowCompletionModal(true);
      } catch (parseError) {
        console.error('Failed to parse completed audit:', parseError);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('auditCompleted', handleAuditComplete);
      window.removeEventListener('storage', handleStorageChange);
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
        content: <ComplianceTrendChart />,
      },
      {
        id: 'maturity-index',
        title: 'Maturity Index',
        description: 'Overall compliance maturity snapshot.',
        visible: true,
        className: dashboardSettings?.showTrendChart === false ? 'lg:col-span-3' : '',
        content: <MaturityRadarChart />,
      },
      {
        id: 'agency-leaderboard',
        title: 'Top Agencies',
        description: 'Comparative performance rankings and insights.',
        visible: dashboardSettings?.showAgencyLeaderboard !== false,
        className: '',
        content: <AgencyLeaderboard />,
      },
      {
        id: 'critical-alerts',
        title: 'Critical Alerts',
        description: 'Priority agencies that need attention now.',
        visible: dashboardSettings?.showCriticalAlerts !== false,
        className: '',
        content: <CriticalAlertsTable />,
      },
    ];

    return reports.filter((report) => report.visible);
  }, [dashboardSettings?.showAgencyLeaderboard, dashboardSettings?.showCriticalAlerts, dashboardSettings?.showTrendChart]);

  const finalizeCancelledAuditUi = () => {
    localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
    localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);
    setActiveAuditId(null);
    setTimeout(() => {
      setIsRunning(false);
      setSteps(AUDIT_STEPS.map((step) => ({ ...step, status: 'pending' })));
      setCancellationState('idle');
    }, 2200);
  };

  const handleAuditStart = async (type: 'url' | 'file', data: string | File, options?: CrawlOptions) => {
    if (type !== 'url' || typeof data !== 'string') {
      setAuditError('Only URL audits are supported');
      return;
    }

    const url = data;
    setAuditError(null);
    setCancellationState('idle');
    setIsRunning(true);
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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}: Audit failed`);
      }

      const responseData = await response.json();
      setSteps((prev) => prev.map((step) => (step.id === 'fetch' ? { ...step, status: 'done' } : step)));

      localStorage.setItem(
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
      localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
    }
  };

  const pollAuditCompletion = async (auditLogId: string, authToken: string, originalStartTime?: number) => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    let auditComplete = false;
    let pollCount = 0;
    let pollInterval = 1000;
    const maxPollInterval = 3000;
    const maxTotalTime = 600000;
    let elapsedTime = 0;
    const startTime = originalStartTime || Date.now();

    while (!auditComplete && elapsedTime < maxTotalTime) {
      try {
        const checkResponse = await fetch(`${API_BASE}/audit/${auditLogId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (checkResponse.ok) {
          const auditData = (await checkResponse.json()) as AuditStatusResponse;
          const auditStatus = auditData.audit?.status;
          const isCancellationPending = Boolean(
            auditData.audit?.cancellation?.requestedAt && !auditData.audit?.cancellation?.completedAt
          );

          if (isCancellationPending) {
            setCancellationState('in_progress');
          } else if (cancellationState === 'in_progress') {
            setCancellationState('idle');
          }

          if (auditStatus === 'success') {
            auditComplete = true;
            setCancellationState('idle');
          } else if (auditStatus === 'failed') {
            throw new Error(auditData.audit?.error || 'Audit failed on server');
          } else if (auditStatus === 'cancelled') {
            setCancellationState('complete');
            finalizeCancelledAuditUi();
            return;
          } else {
            const progressPercent = Math.min((elapsedTime / 60000) * 100, 95);
            const stepIndex = Math.floor((progressPercent / 100) * (AUDIT_STEPS.length - 1));

            setSteps((prev) => {
              const updated = prev.map((step, idx) => {
                if (idx < stepIndex) return { ...step, status: 'done' as const };
                if (idx === stepIndex) return { ...step, status: 'running' as const };
                return { ...step, status: 'pending' as const };
              });
              localStorage.setItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS, JSON.stringify(updated));
              return updated;
            });
          }
        }

        pollCount += 1;
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        pollInterval = Math.min(pollInterval + 500, maxPollInterval);
        elapsedTime = Date.now() - startTime;
      } catch (pollError) {
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
    localStorage.setItem(
      DASHBOARD_CONFIG.STORAGE_KEYS.COMPLETED_AUDIT,
      JSON.stringify({
        auditLogId,
        completedAt: Date.now(),
      })
    );
    localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
    localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);
    setIsRunning(false);
    setCancellationState('idle');
  };

  useEffect(() => {
    if (!activeAuditId || !token) return;

    const resumePolling = async () => {
      try {
        const activeAudit = localStorage.getItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
        const originalStartTime = activeAudit ? JSON.parse(activeAudit).startTime : undefined;
        await pollAuditCompletion(activeAuditId, token, originalStartTime);
      } catch (pollError) {
        const errorMsg = pollError instanceof Error ? pollError.message : 'Unknown error occurred';
        setAuditError(errorMsg);
        setSteps((prev) => prev.map((step) => (step.status === 'running' ? { ...step, status: 'failed' } : step)));
        setIsRunning(false);
        setCancellationState('idle');
        localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.ACTIVE_AUDIT);
        localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.AUDIT_STEPS);
      }
    };

    resumePolling();
  }, [activeAuditId, token]);

  useEffect(() => {
    if (!token) return;

    const fetchDashboardStats = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
        const response = await fetch(`${API_BASE}/dashboard/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return;
        const data = await response.json();
        setDashboardStats({
          totalAgencies: data.totalAgencies || 0,
          averageCompliance: parseFloat(data.averageCompliance) || 0,
          totalAudits: data.totalAudits || 0,
          statusDistribution: data.statusDistribution || { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 },
        });
      } catch (statsError) {
        console.error('[Dashboard] Failed to fetch summary stats:', statsError);
      }
    };

    fetchDashboardStats();
    const interval = setInterval(fetchDashboardStats, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleViewResults = () => {
    if (!completedAuditId) return;
    localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.COMPLETED_AUDIT);
    setShowCompletionModal(false);
    navigate(`/audit/${completedAuditId}`);
  };

  const handleStayOnPage = () => {
    localStorage.removeItem(DASHBOARD_CONFIG.STORAGE_KEYS.COMPLETED_AUDIT);
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

      setCancellationState('in_progress');
      setAuditError(null);
      setCancelConfirmationOpen(false);
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
      alert('Failed to export the selected reports. Please try again.');
    } finally {
      setIsExportingReports(false);
    }
  };

  return (
    <div className={cn('min-h-full space-y-8 py-8', brandColors.appShell.contentPadding)}>
      {showCompletionModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <Card className={cn('mx-4 w-full max-w-md border-green-200 bg-white shadow-lg', brandColors.surfaces.primaryCard)}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <CardTitle className="text-slate-900">Audit Complete!</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-700">
                Your audit has been successfully completed and the results are ready to view.
              </p>
              <div className="flex gap-3 pt-4">
                <Button onClick={handleViewResults} className="flex-1 bg-green-600 hover:bg-green-700">
                  View Results
                </Button>
                <Button onClick={handleStayOnPage} variant="outline" className="flex-1">
                  Stay on Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-800">Audit Dashboard</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Start a new compliance run, monitor live progress, and review the latest operational signals across MASID.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mx-auto w-full max-w-3xl xl:mx-0 xl:max-w-none">
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
        </div>

        <div className="xl:col-span-1">
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
        </div>
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
