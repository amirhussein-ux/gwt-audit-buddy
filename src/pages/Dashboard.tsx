import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MaturityRadarChart } from '@/components/dashboard/MaturityRadarChart';
import { ComplianceTrendChart } from '@/components/dashboard/ComplianceTrendChart';
import { AgencyLeaderboard } from '@/components/dashboard/AgencyLeaderboard';
import { CriticalAlertsTable } from '@/components/dashboard/CriticalAlertsTable';
import { AuditSummaryReport } from '@/components/AuditSummaryReport';
import AuditInput from '@/components/AuditInput';
import AuditProgress, { type AuditStep as AuditProgressStep } from '@/components/AuditProgress';

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
  const [steps, setSteps] = useState<AuditProgressStep[]>(
    AUDIT_STEPS.map((step) => ({ ...step, status: 'pending' }))
  );

  // Check for recent audit result in localStorage
  useEffect(() => {
    const savedAudit = localStorage.getItem('lastAuditResult');
    if (savedAudit && location.pathname === '/dashboard') {
      try {
        setLastAudit(JSON.parse(savedAudit));
      } catch (e) {
        console.error('Failed to parse saved audit:', e);
      }
    }
  }, [location.pathname]);

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

      // Poll for completion before redirecting
      if (responseData.auditLogId) {
        console.log('[Dashboard] Polling for audit completion:', responseData.auditLogId);
        
        // Poll until audit status is 'success'
        // Use exponential backoff: start at 1s, increase to 3s, max 120 seconds total
        let auditComplete = false;
        let pollCount = 0;
        let pollInterval = 1000; // Start at 1 second
        const maxPollInterval = 3000; // Max 3 seconds per poll
        const maxTotalTime = 120000; // 120 seconds max wait (increased from 90s to accommodate new detection logic)
        let elapsedTime = 0;
        const startTime = Date.now();
        
        while (!auditComplete && elapsedTime < maxTotalTime) {
          try {
            // Show progress with elapsed time
            const elapsedSeconds = Math.round(elapsedTime / 1000);
            console.log(`[Dashboard] Poll ${pollCount} (${elapsedSeconds}s): Checking audit status...`);
            
            const checkResponse = await fetch(`${API_BASE}/audit/${responseData.auditLogId}`, {
              headers: { 'Authorization': `Bearer ${token}` },
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
                // Simulate step progression
                const progressPercent = Math.min((elapsedTime / 60000) * 100, 95); // Max 95% while in progress
                const stepIndex = Math.floor((progressPercent / 100) * (AUDIT_STEPS.length - 1));
                
                setSteps((prev) => 
                  prev.map((s, idx) => {
                    if (idx < stepIndex) return { ...s, status: 'done' };
                    if (idx === stepIndex) return { ...s, status: 'running' };
                    return { ...s, status: 'pending' };
                  })
                );
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
          console.log('[Dashboard] Redirecting to audit detail:', responseData.auditLogId);
          setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
          navigate(`/audit/${responseData.auditLogId}`);
          setIsRunning(false);
        } else {
          throw new Error(`Audit processing timed out after ${Math.round(elapsedTime / 1000)}s. Please try refreshing the page in a moment.`);
        }
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
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
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
                  Audit in progress... You will be redirected to the results page when complete.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Summary Report - Only show if there's a recent audit result */}
        {lastAudit && (
          <AuditSummaryReport 
            audit={lastAudit}
          />
        )}

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Maturity Index (spans 1 column) */}
          <MaturityRadarChart />

          {/* Agency Leaderboard (spans 1 column) */}
          <AgencyLeaderboard />

          {/* Compliance Trend (spans 2 columns) */}
          <ComplianceTrendChart />
        </div>

        {/* Critical Alerts (spans full width) */}
        <div className="grid grid-cols-1">
          <CriticalAlertsTable />
        </div>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-slate-600">Total Agencies</p>
                <p className="text-2xl font-bold text-blue-600">--</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-slate-600">Avg Compliance</p>
                <p className="text-2xl font-bold text-green-600">--</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-slate-600">Total Audits</p>
                <p className="text-2xl font-bold text-purple-600">--</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-slate-600">Critical Alerts</p>
                <p className="text-2xl font-bold text-orange-600">--</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}