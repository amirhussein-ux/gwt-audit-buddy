import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, AlertCircle, Search } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

const AUDIT_LOG_CONFIG = {
  API: {
    BASE: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
    HEADERS: {
      AUTHORIZATION: 'Authorization',
      CONTENT_TYPE: 'Content-Type',
      CONTENT_TYPE_VALUE: 'application/json',
    },
  },
  QUERY: {
    STALE_TIME: 5 * 60 * 1000,
    GC_TIME: 30 * 60 * 1000,
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
    STATUS_ALL: 'all',
  },
};

interface AuditLogEntry {
  _id: string;
  auditUrl: string;
  status: string | { status: string };
  agency?: { name?: string; tags?: string[] } | string;
  auditedBy?: { username: string; email: string; role: string };
  createdAt: string;
  pst?: { found: boolean };
  transparencySeal?: { found: boolean };
}

export default function AuditLogPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [completedAuditId, setCompletedAuditId] = useState<string | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(AUDIT_LOG_CONFIG.FILTERS.DATE_OPTIONS.ALL);
  const [statusFilter, setStatusFilter] = useState(AUDIT_LOG_CONFIG.FILTERS.STATUS_ALL);

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const response = await fetch(`${AUDIT_LOG_CONFIG.API.BASE}/audit`, {
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
      const auditList = data.audits || [];
      return auditList.sort((a: AuditLogEntry, b: AuditLogEntry) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    enabled: !!token,
    staleTime: AUDIT_LOG_CONFIG.QUERY.STALE_TIME,
    gcTime: AUDIT_LOG_CONFIG.QUERY.GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

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
      const completedAudit = localStorage.getItem(AUDIT_LOG_CONFIG.STORAGE.COMPLETED_AUDIT);
      if (completedAudit) {
        try {
          const auditData = JSON.parse(completedAudit);
          setCompletedAuditId(auditData.auditLogId);
          setShowCompletionModal(true);
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

  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    (logs || []).forEach((log: AuditLogEntry) => {
      const agencyTags = typeof log.agency === 'object' ? log.agency?.tags || [] : [];
      agencyTags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];

    let filtered = logs;

    if (searchQuery.trim()) {
      filtered = filtered.filter((log: AuditLogEntry) => {
        const agencyName =
          typeof log.agency === 'object' ? (log.agency?.name ?? '') : (log.agency ?? '');
        return (
          log.auditUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agencyName.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }

    if (statusFilter !== AUDIT_LOG_CONFIG.FILTERS.STATUS_ALL) {
      filtered = filtered.filter((log: AuditLogEntry) => {
        const statusValue = typeof log.status === 'object' ? (log.status.status || 'unknown') : log.status || 'unknown';
        const normalizedStatus = statusValue.toLowerCase();
        if (statusFilter === 'success') return normalizedStatus === 'success' || normalizedStatus === 'completed';
        if (statusFilter === 'cancelled') return normalizedStatus === 'cancelled' || normalizedStatus === 'canceled';
        if (statusFilter === 'failed') return normalizedStatus === 'failed';
        return false;
      });
    }

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
        }
        if (dateFilter === AUDIT_LOG_CONFIG.FILTERS.DATE_OPTIONS.WEEK) {
          return logDateOnly >= weekAgo && logDateOnly <= today;
        }
        if (dateFilter === AUDIT_LOG_CONFIG.FILTERS.DATE_OPTIONS.MONTH) {
          return logDateOnly >= monthAgo && logDateOnly <= today;
        }
        return true;
      });
    }

    return filtered;
  }, [logs, searchQuery, dateFilter, statusFilter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return <CheckCircle className="h-5 w-5 text-emerald-600" />;
      case 'in-progress':
      case 'in_progress':
        return <Clock className="h-5 w-5 text-sky-600" />;
      case 'failed':
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-rose-600" />;
      default:
        return <Clock className="h-5 w-5 text-slate-500" />;
    }
  };

  const filterInputClassName =
    'h-11 rounded-2xl border-white/70 bg-white/78 pl-10 shadow-[0_10px_24px_rgba(148,163,184,0.08)] backdrop-blur-md';
  const filterSelectClassName =
    'h-11 rounded-2xl border border-white/70 bg-white/78 px-4 text-sm font-medium text-slate-700 shadow-[0_10px_24px_rgba(148,163,184,0.08)] backdrop-blur-md transition-colors hover:bg-white';

  return (
    <div className={cn('min-h-full space-y-8 py-8', brandColors.appShell.contentPadding)}>
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className={cn('mx-4 w-full max-w-md border-green-200 bg-white shadow-lg', brandColors.surfaces.primaryCard)}>
            <CardHeader className="border-b border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <CardTitle className="text-green-600">Audit Complete!</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 py-6">
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
      )}

      <section className="space-y-6">
        {error && (
          <Card className={cn(brandColors.surfaces.dashboardCard, 'border-red-200 bg-red-50/90')}>
            <CardContent className="pt-6">
              <p className="text-red-800">{error instanceof Error ? error.message : 'Failed to load audit logs'}</p>
            </CardContent>
          </Card>
        )}

        {logs && logs.length > 0 && (
          <Card className={cn(brandColors.surfaces.dashboardCard, 'bg-white/65')}>
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:flex-wrap md:items-center">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by domain or agency..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={filterInputClassName}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={filterSelectClassName}>
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterSelectClassName}>
                  <option value={AUDIT_LOG_CONFIG.FILTERS.STATUS_ALL}>All Statuses</option>
                  <option value="success">Success</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && (!logs || logs.length === 0) && (
          <Card className={cn(brandColors.surfaces.dashboardCard, 'border-dashed bg-white/60')}>
            <CardContent className="flex flex-col items-center justify-center py-14">
              <div className="text-center">
                <h3 className="mb-2 text-lg font-medium text-slate-900">No Audit History</h3>
                <p className="text-slate-600">No audits have been performed yet</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && logs && logs.length > 0 && filteredLogs.length === 0 && (
          <Card className={cn(brandColors.surfaces.dashboardCard, 'border-dashed bg-white/60')}>
            <CardContent className="flex flex-col items-center justify-center py-14">
              <div className="text-center">
                <h3 className="mb-2 text-lg font-medium text-slate-900">No Results Found</h3>
                  <p className="mb-6 text-slate-600">Try adjusting your search, date, or status filter</p>
                <Button
                  onClick={() => {
                    setSearchQuery('');
                    setDateFilter('all');
                    setStatusFilter(AUDIT_LOG_CONFIG.FILTERS.STATUS_ALL);
                  }}
                  className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-500 text-white hover:from-violet-500 hover:to-indigo-500"
                >
                  Reset Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <Card className={cn(brandColors.surfaces.dashboardCard, 'bg-white/60')}>
            <CardContent className="py-16 text-center">
              <p className="text-slate-600">Loading audit history...</p>
            </CardContent>
          </Card>
        ) : (
          filteredLogs.length > 0 && (
            <Card className={brandColors.surfaces.dashboardCard}>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-white/50">
                        <th className="px-5 py-4 text-left font-semibold text-slate-900">Date</th>
                        <th className="px-5 py-4 text-left font-semibold text-slate-900">Auditor</th>
                        <th className="px-5 py-4 text-left font-semibold text-slate-900">Agency</th>
                        <th className="px-5 py-4 text-left font-semibold text-slate-900">Tags</th>
                        <th className="px-5 py-4 text-left font-semibold text-slate-900">Status</th>
                        <th className="px-5 py-4 text-left font-semibold text-slate-900">Web URL</th>
                        <th className="px-5 py-4 text-left font-semibold text-slate-900">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log: AuditLogEntry) => {
                        const agencyName =
                          typeof log.agency === 'object' ? (log.agency.name ?? '-') : (log.agency ?? '-');
                        const agencyTags = typeof log.agency === 'object' ? log.agency.tags || [] : [];
                        const auditorName = log.auditedBy?.username || log.auditedBy?.email || '-';
                        const statusValue =
                          typeof log.status === 'object' ? (log.status.status ?? 'unknown') : log.status || 'unknown';

                        return (
                          <tr key={log._id} className="border-b border-slate-100/80 transition-colors hover:bg-white/55">
                            <td className="px-5 py-4 text-slate-600">{new Date(log.createdAt).toLocaleDateString()}</td>
                            <td className="px-5 py-4 text-sm font-medium text-slate-900">{auditorName}</td>
                            <td className="px-5 py-4 font-medium text-slate-900">{agencyName}</td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                {agencyTags.length > 0 ? (
                                  agencyTags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="rounded-full bg-sky-100 text-sky-700 hover:bg-sky-100">
                                      {tag}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-400">No tags</span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(statusValue)}
                                <Badge
                                  variant={statusValue === 'success' || statusValue === 'completed' ? 'default' : 'secondary'}
                                  className={cn(
                                    'rounded-full text-xs',
                                    statusValue === 'success' || statusValue === 'completed'
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                      : statusValue === 'failed' || statusValue === 'cancelled'
                                        ? 'bg-rose-100 text-rose-700 hover:bg-rose-100'
                                        : 'bg-sky-100 text-sky-700 hover:bg-sky-100'
                                  )}
                                >
                                  {statusValue === 'success' ? 'Completed' : statusValue.replace('_', ' ')}
                                </Badge>
                              </div>
                            </td>
                            <td className="max-w-xs truncate px-5 py-4 text-slate-600">{log.auditUrl}</td>
                            <td className="px-5 py-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/audit/${log._id}`)}
                                className="rounded-2xl border-white/60 bg-white/70 text-xs hover:bg-white"
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
      </section>
    </div>
  );
}
