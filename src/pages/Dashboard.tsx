import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MaturityRadarChart } from '@/components/dashboard/MaturityRadarChart';
import { ComplianceTrendChart } from '@/components/dashboard/ComplianceTrendChart';
import { AgencyLeaderboard } from '@/components/dashboard/AgencyLeaderboard';
import { CriticalAlertsTable } from '@/components/dashboard/CriticalAlertsTable';
import { AuditSummaryReport } from '@/components/AuditSummaryReport';
import AuditInput from '@/components/AuditInput';
import AuditProgress, { type AuditStep as AuditProgressStep } from '@/components/AuditProgress';
import { CheckCircle } from 'lucide-react';

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
  const { token } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [lastAudit, setLastAudit] = useState<AuditDataForDisplay | null>(null);
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);
  const [completedAuditId, setCompletedAuditId] = useState<string | null>(null);
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

  // Check for recent audit result and active audit in progress
  useEffect(() => {
    const savedAudit = localStorage.getItem('lastAuditResult');
    if (savedAudit && location.pathname === '/dashboard') {
      try {
        setLastAudit(JSON.parse(savedAudit));
      } catch (e) {
        console.error('Failed to parse saved audit:', e);
      }
    }

    // Check if there's an active audit in progress
    const activeAudit = localStorage.getItem('activeAudit');
    if (activeAudit) {
      try {
        const auditData = JSON.parse(activeAudit);
        setActiveAuditId(auditData.auditLogId);
        setIsRunning(true);
        // Restore progress steps
        const savedSteps = localStorage.getItem('auditSteps');
        if (savedSteps) {
          setSteps(JSON.parse(savedSteps));
        }
      } catch (e) {
        console.error('Failed to parse active audit:', e);
        localStorage.removeItem('activeAudit');
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
      const completedAudit = localStorage.getItem('completedAudit');
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
      localStorage.setItem('activeAudit', JSON.stringify({
        auditLogId: responseData.auditLogId,
        startTime: Date.now(),
        url: url,
      }));

      // Poll for completion before redirecting
      if (responseData.auditLogId) {
        console.log('[Dashboard] Polling for audit completion:', responseData.auditLogId);
        pollAuditCompletion(responseData.auditLogId, token);
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
      localStorage.removeItem('activeAudit');
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
              localStorage.setItem('auditSteps', JSON.stringify(updated));
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
        // If it's a server error, throw immediately
        if (pollError instanceof Error && pollError.message.includes('failed')) {
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
      localStorage.setItem('completedAudit', JSON.stringify({
        auditLogId: auditLogId,
        completedAt: Date.now(),
      }));
      
      // Clean up active audit data
      localStorage.removeItem('activeAudit');
      localStorage.removeItem('auditSteps');
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
          const activeAudit = localStorage.getItem('activeAudit');
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
          localStorage.removeItem('activeAudit');
          localStorage.removeItem('auditSteps');
        }
      };
      resumePolling();
    }
  }, [activeAuditId, token, isRunning]);

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
      localStorage.removeItem('completedAudit');
      setShowCompletionModal(false);
      navigate(`/audit/${completedAuditId}`);
    }
  };

  const handleStayOnPage = () => {
    localStorage.removeItem('completedAudit');
    setShowCompletionModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Audit Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4 border-green-200 bg-white shadow-lg">
            <CardHeader className="border-b border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <CardTitle className="text-green-600">Audit Complete!</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="py-6 space-y-4">
              <p className="text-slate-700">
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
                  className="flex-1"
                >
                  Stay on Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-slate-900">MASID Dashboard</h1>
          <p className="text-sm text-slate-600">
            Monitoring and Automated Standards Inspection Dashboard
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Quick Stats / System Overview */}
        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-slate-600">Total Agencies</p>
                <p className="text-2xl font-bold text-blue-600">{dashboardStats.totalAgencies}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-slate-600">Avg Compliance</p>
                <p className="text-2xl font-bold text-green-600">{dashboardStats.averageCompliance}%</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-slate-600">Total Audits</p>
                <p className="text-2xl font-bold text-purple-600">{dashboardStats.totalAudits}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-slate-600">Critical Alerts</p>
                <p className="text-2xl font-bold text-orange-600">{dashboardStats.statusDistribution.critical}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* New Audit Form (always displayed) */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>Run New Audit</CardTitle>
            <CardDescription>
              Enter a government agency website URL to audit compliance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {auditError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800"><strong>Error:</strong> {auditError}</p>
              </div>
            )}
            {!isRunning ? (
              <AuditInput onStartAudit={handleAuditStart} isAuditing={isRunning} />
            ) : (
              <div className="space-y-4">
                <AuditProgress steps={steps} isVisible={isRunning} />
                <p className="text-sm text-slate-600 text-center">
                  Audit in progress... You will receive a notification when complete.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Dashboard Grid - Compliance Trend (left 2 cols) + Maturity Index (right 1 col) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Compliance Trend (spans 2 columns on left) */}
          <div className="lg:col-span-2">
            <ComplianceTrendChart />
          </div>

          {/* Maturity Index (spans 1 column on right) */}
          <MaturityRadarChart />
        </div>

        {/* Agency Leaderboard (full width) */}
        <AgencyLeaderboard />
      </div>
    </div>
  );
}