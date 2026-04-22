import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, AlertCircle, Search } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';

/**
 * Audit log page configuration
 * Contains API settings, query caching, and storage keys
 */
const AUDIT_LOG_CONFIG = {
  API: {
    BASE: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
    ENDPOINTS: {
      AUDITS: '/audit',
    },
    HEADERS: {
      AUTHORIZATION: 'Authorization',
      CONTENT_TYPE: 'Content-Type',
      CONTENT_TYPE_VALUE: 'application/json',
    },
  },
  QUERY: {
    STALE_TIME: 5 * 60 * 1000, // 5 minutes
    GC_TIME: 30 * 60 * 1000, // 30 minutes
  },
  STORAGE: {
    COMPLETED_AUDIT: 'completedAudit',
  },
  FILTERS: {
    DATE_OPTIONS: {
      ALL: 'all',
      TODAY: 'today',
      WEEK: 'week',
      MONTH: 'month',
    },
  },
};

interface AuditLogEntry {
  _id: string;
  auditUrl: string;
  status: string | { status: string };
  agency?: string | { name: string };
  auditedBy?: { username: string; email: string; role: string };
  createdAt: string;
  pst?: { found: boolean };
  transparencySeal?: { found: boolean };
}

export default function AuditLogPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  // State for audit completion modal
  const [completedAuditId, setCompletedAuditId] = useState<string | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(AUDIT_LOG_CONFIG.FILTERS.DATE_OPTIONS.ALL);

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const response = await fetch(`${AUDIT_LOG_CONFIG.API.BASE}${AUDIT_LOG_CONFIG.API.ENDPOINTS.AUDITS}`, {
        headers: { 
          [AUDIT_LOG_CONFIG.API.HEADERS.AUTHORIZATION]: `Bearer ${token}`,
          [AUDIT_LOG_CONFIG.API.HEADERS.CONTENT_TYPE]: AUDIT_LOG_CONFIG.API.HEADERS.CONTENT_TYPE_VALUE,
        },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch audit logs');
      }
      const data = await response.json();
      // The endpoint returns { audits, total, skip, limit }
      const auditList = data.audits || [];
      // Sort by createdAt descending (most recent first)
      return auditList.sort((a: AuditLogEntry, b: AuditLogEntry) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    enabled: !!token, // Only run if we have a token
    staleTime: AUDIT_LOG_CONFIG.QUERY.STALE_TIME,
    gcTime: AUDIT_LOG_CONFIG.QUERY.GC_TIME,
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch on reconnect
  });

  // Global listener for completed audits (works across all pages)
  useEffect(() => {
    const handleAuditComplete = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.auditLogId) {
        setCompletedAuditId(customEvent.detail.auditLogId);
        setShowCompletionModal(true);
        console.log('[AuditLogPage] Audit completed, showing modal:', customEvent.detail.auditLogId);
      }
    };

    // Listen for custom audit completion event
    window.addEventListener('auditCompleted', handleAuditComplete);
    
    // Also listen for storage changes from other tabs/windows
    const handleStorageChange = () => {
      const completedAudit = localStorage.getItem(AUDIT_LOG_CONFIG.STORAGE.COMPLETED_AUDIT);
      if (completedAudit) {
        try {
          const auditData = JSON.parse(completedAudit);
          setCompletedAuditId(auditData.auditLogId);
          setShowCompletionModal(true);
          console.log('[AuditLogPage] Audit completed (from other tab), showing modal:', auditData.auditLogId);
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

  // Handle completion modal actions
  const handleViewResults = () => {
    if (completedAuditId) {
      localStorage.removeItem(AUDIT_LOG_CONFIG.STORAGE.COMPLETED_AUDIT);
      setShowCompletionModal(false);
      navigate(`/audit/${completedAuditId}`);
    }
  };

  const handleStayOnPage = () => {
    localStorage.removeItem(AUDIT_LOG_CONFIG.STORAGE.COMPLETED_AUDIT);
    setShowCompletionModal(false);
  };

  // Filter and search logic
  const filteredLogs = useMemo(() => {
    if (!logs) return [];

    let filtered = logs;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter((log: AuditLogEntry) => {
        let agencyName = '';
        if (log.agency) {
          agencyName = typeof log.agency === 'object' ? (log.agency.name ?? '') : log.agency;
        }
        return log.auditUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agencyName.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    // Apply date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    if (dateFilter !== AUDIT_LOG_CONFIG.FILTERS.DATE_OPTIONS.ALL) {
      filtered = filtered.filter((log: AuditLogEntry) => {
        const logDate = new Date(log.createdAt);
        const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());

        if (dateFilter === AUDIT_LOG_CONFIG.FILTERS.DATE_OPTIONS.TODAY) {
          return logDateOnly.getTime() === today.getTime();
        } else if (dateFilter === AUDIT_LOG_CONFIG.FILTERS.DATE_OPTIONS.WEEK) {
          return logDateOnly >= weekAgo && logDateOnly <= today;
        } else if (dateFilter === AUDIT_LOG_CONFIG.FILTERS.DATE_OPTIONS.MONTH) {
          return logDateOnly >= monthAgo && logDateOnly <= today;
        }
        return true;
      });
    }

    return filtered;
  }, [logs, searchQuery, dateFilter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-slate-600" />;
    }
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

      <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-slate-600 mt-2">
          Complete history of all website audits performed
        </p>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error instanceof Error ? error.message : 'Failed to load audit logs'}</p>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter Bar */}
      {logs && logs.length > 0 && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by domain or agency..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 rounded-md border border-slate-200 bg-white text-slate-900 text-sm font-medium hover:bg-slate-50"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && (!logs || logs.length === 0) && (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Audit History</h3>
              <p className="text-slate-600">
                No audits have been performed yet
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No results after filtering */}
      {!isLoading && !error && logs && logs.length > 0 && filteredLogs.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Results Found</h3>
              <p className="text-slate-600 mb-6">
                Try adjusting your search or date filter
              </p>
              <Button
                onClick={() => {
                  setSearchQuery('');
                  setDateFilter('all');
                }}
              >
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-slate-600">Loading audit history...</p>
        </div>
      ) : (
        filteredLogs.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-900">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900">Auditor</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900">Agency</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900">Web URL</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-900">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log: AuditLogEntry) => {
                      // Safely extract values in case they're objects
                      let agencyName = '—';
                      if (log.agency) {
                        agencyName = typeof log.agency === 'object' ? (log.agency.name ?? '—') : log.agency;
                      }
                      
                      let auditorName = '—';
                      if (log.auditedBy) {
                        auditorName = log.auditedBy.username || log.auditedBy.email || '—';
                      }
                      
                      let statusValue = 'unknown';
                      if (log.status) {
                        statusValue = typeof log.status === 'object' ? (log.status.status ?? 'unknown') : log.status;
                      }
                      
                      return (
                        <tr key={log._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-4 text-slate-600">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-4 text-slate-900 font-medium text-sm">
                            {auditorName}
                          </td>
                          <td className="py-4 px-4 text-slate-900 font-medium">
                            {agencyName}
                          </td>
                          <td className="py-4 px-4">
                            <Badge
                              variant={statusValue === 'success' || statusValue === 'completed' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {statusValue === 'success' ? 'Completed' : (statusValue.charAt(0).toUpperCase() + statusValue.slice(1))}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-slate-600 max-w-xs truncate">
                            {log.auditUrl}
                          </td>
                          <td className="py-4 px-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/audit/${log._id}`)}
                              className="text-xs"
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      )}
      </div>
    </div>
  );
}
