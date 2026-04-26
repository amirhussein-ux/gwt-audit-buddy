import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ArrowRight, Search, Archive } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

const RESULTS_CONFIG = {
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
    STALE_TIME: 5 * 60 * 1000,
    GC_TIME: 30 * 60 * 1000,
  },
  STORAGE: {
    COMPLETED_AUDIT: 'completedAudit',
  },
  PAGINATION: {
    ITEMS_PER_PAGE: 10,
  },
  FILTERS: {
    DATE_OPTIONS: {
      ALL: 'all',
      TODAY: 'today',
      WEEK: 'week',
      MONTH: 'month',
    },
  },
  ROUTES: {
    AUDIT: '/audit',
  },
};

interface AuditResult {
  _id: string;
  auditUrl: string;
  status: string;
  createdAt: string;
  pst?: { found: boolean };
  transparencySeal?: { found: boolean };
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token, user } = useAuth();

  const [completedAuditId, setCompletedAuditId] = useState<string | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(RESULTS_CONFIG.FILTERS.DATE_OPTIONS.ALL);
  const [currentPage, setCurrentPage] = useState(1);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveConfirmation, setArchiveConfirmation] = useState<{ isOpen: boolean; auditId: string | null }>({
    isOpen: false,
    auditId: null,
  });

  const handleArchiveClick = (auditId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setArchiveConfirmation({ isOpen: true, auditId });
  };

  const handleArchiveConfirm = async () => {
    if (!archiveConfirmation.auditId || !token) return;

    setArchivingId(archiveConfirmation.auditId);
    try {
      const response = await fetch(`${RESULTS_CONFIG.API.BASE}/audit/${archiveConfirmation.auditId}/archive`, {
        method: 'POST',
        headers: {
          [RESULTS_CONFIG.API.HEADERS.AUTHORIZATION]: `Bearer ${token}`,
          [RESULTS_CONFIG.API.HEADERS.CONTENT_TYPE]: RESULTS_CONFIG.API.HEADERS.CONTENT_TYPE_VALUE,
        },
        body: JSON.stringify({ reason: 'Archived from results page' }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to archive audit');
      }

      await queryClient.invalidateQueries({ queryKey: ['audits'] });
      await queryClient.invalidateQueries({ queryKey: ['archived-audits'] });
      setArchiveConfirmation({ isOpen: false, auditId: null });
    } catch (error) {
      console.error('Archive error:', error);
      alert(`Error archiving audit: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setArchiveConfirmation({ isOpen: false, auditId: null });
    } finally {
      setArchivingId(null);
    }
  };

  const { data: audits, isLoading, error } = useQuery({
    queryKey: ['audits'],
    queryFn: async () => {
      const response = await fetch(`${RESULTS_CONFIG.API.BASE}${RESULTS_CONFIG.API.ENDPOINTS.AUDITS}`, {
        headers: {
          [RESULTS_CONFIG.API.HEADERS.AUTHORIZATION]: `Bearer ${token}`,
          [RESULTS_CONFIG.API.HEADERS.CONTENT_TYPE]: RESULTS_CONFIG.API.HEADERS.CONTENT_TYPE_VALUE,
        },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch audits');
      }
      const result = await response.json();
      return result.audits || [];
    },
    enabled: !!token,
    staleTime: RESULTS_CONFIG.QUERY.STALE_TIME,
    gcTime: RESULTS_CONFIG.QUERY.GC_TIME,
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
      const completedAudit = localStorage.getItem(RESULTS_CONFIG.STORAGE.COMPLETED_AUDIT);
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
      localStorage.removeItem(RESULTS_CONFIG.STORAGE.COMPLETED_AUDIT);
      setShowCompletionModal(false);
      navigate(`${RESULTS_CONFIG.ROUTES.AUDIT}/${completedAuditId}`);
    }
  };

  const filteredAudits = useMemo(() => {
    if (!audits) return [];

    let filtered = audits;

    if (searchQuery.trim()) {
      filtered = filtered.filter((audit: AuditResult) =>
        audit.auditUrl.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    if (dateFilter !== RESULTS_CONFIG.FILTERS.DATE_OPTIONS.ALL) {
      filtered = filtered.filter((audit: AuditResult) => {
        const auditDate = new Date(audit.createdAt);
        const auditDateOnly = new Date(auditDate.getFullYear(), auditDate.getMonth(), auditDate.getDate());

        if (dateFilter === RESULTS_CONFIG.FILTERS.DATE_OPTIONS.TODAY) {
          return auditDateOnly.getTime() === today.getTime();
        } else if (dateFilter === RESULTS_CONFIG.FILTERS.DATE_OPTIONS.WEEK) {
          return auditDateOnly >= weekAgo && auditDateOnly <= today;
        } else if (dateFilter === RESULTS_CONFIG.FILTERS.DATE_OPTIONS.MONTH) {
          return auditDateOnly >= monthAgo && auditDateOnly <= today;
        }
        return true;
      });
    }

    return filtered;
  }, [audits, searchQuery, dateFilter]);

  const totalPages = Math.ceil(filteredAudits.length / RESULTS_CONFIG.PAGINATION.ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * RESULTS_CONFIG.PAGINATION.ITEMS_PER_PAGE;
  const endIndex = startIndex + RESULTS_CONFIG.PAGINATION.ITEMS_PER_PAGE;
  const paginatedAudits = filteredAudits.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFilter]);

  const handleStayOnPage = () => {
    localStorage.removeItem(RESULTS_CONFIG.STORAGE.COMPLETED_AUDIT);
    setShowCompletionModal(false);
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

      <section className="space-y-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-800">
            Web Accessibility Audit Results
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Browse completed audit runs, filter by timeline, and open the full compliance report for each website.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        {error && (
          <Card className={cn(brandColors.surfaces.dashboardCard, 'border-red-200 bg-red-50/90')}>
            <CardContent className="pt-6">
              <p className="text-red-800">{error instanceof Error ? error.message : 'Failed to load audits'}</p>
              <Button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-500 text-white hover:from-violet-500 hover:to-indigo-500"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {audits && audits.length > 0 && (
          <Card className={cn(brandColors.surfaces.dashboardCard, 'bg-white/65')}>
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by domain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={filterInputClassName}
                />
              </div>
              <div className="flex gap-2">
                <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={filterSelectClassName}>
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && (!audits || audits.length === 0) && (
          <Card className={cn(brandColors.surfaces.dashboardCard, 'border-dashed bg-white/60')}>
            <CardContent className="flex flex-col items-center justify-center py-14">
              <div className="text-center">
                <h3 className="mb-2 text-lg font-medium text-slate-900">No Audit Results Yet</h3>
                <p className="mb-6 text-slate-600">
                  Run your first audit from the Dashboard to see results here
                </p>
                <Button
                  onClick={() => navigate('/dashboard')}
                  className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-500 text-white hover:from-violet-500 hover:to-indigo-500"
                >
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && audits && audits.length > 0 && filteredAudits.length === 0 && (
          <Card className={cn(brandColors.surfaces.dashboardCard, 'border-dashed bg-white/60')}>
            <CardContent className="flex flex-col items-center justify-center py-14">
              <div className="text-center">
                <h3 className="mb-2 text-lg font-medium text-slate-900">No Results Found</h3>
                <p className="mb-6 text-slate-600">
                  Try adjusting your search or date filter
                </p>
                <Button
                  onClick={() => {
                    setSearchQuery('');
                    setDateFilter(RESULTS_CONFIG.FILTERS.DATE_OPTIONS.ALL);
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
              <p className="text-slate-600">Loading audit results...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {paginatedAudits?.map((audit: AuditResult) => (
                <Card
                  key={audit._id}
                  className={cn(
                    brandColors.surfaces.dashboardCard,
                    'cursor-pointer bg-white/72 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(129,140,248,0.12)]'
                  )}
                  onClick={() => navigate(`/audit/${audit._id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-lg text-slate-900">{audit.auditUrl}</CardTitle>
                        <CardDescription className="mt-1 text-slate-500">
                          {new Date(audit.createdAt).toLocaleDateString()} at{' '}
                          {new Date(audit.createdAt).toLocaleTimeString()}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={audit.status === 'completed' ? 'default' : 'secondary'}
                        className={cn(
                          'rounded-full',
                          audit.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-100'
                        )}
                      >
                        {audit.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-blue-50/90 p-4 text-center shadow-sm">
                        <p className="text-xs text-slate-600">PST</p>
                        <p
                          className={cn(
                            'text-sm font-semibold',
                            audit.pst?.found ? 'text-emerald-700' : 'text-rose-600'
                          )}
                        >
                          {audit.pst?.found ? 'Present' : 'Missing'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-violet-50/90 p-4 text-center shadow-sm">
                        <p className="text-xs text-slate-600">Transparency Seal</p>
                        <p
                          className={cn(
                            'text-sm font-semibold',
                            audit.transparencySeal?.found ? 'text-emerald-700' : 'text-rose-600'
                          )}
                        >
                          {audit.transparencySeal?.found ? 'Present' : 'Missing'}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/70 pt-3">
                      <p className="mb-2 text-xs font-semibold text-slate-600">Evaluations Performed</p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="rounded-full bg-violet-100 text-violet-700 hover:bg-violet-100">Web Presence</Badge>
                        <Badge variant="secondary" className="rounded-full bg-sky-100 text-sky-700 hover:bg-sky-100">Web Usability</Badge>
                        <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 hover:bg-amber-100">Performance</Badge>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full rounded-2xl border-white/60 bg-white/70 hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/audit/${audit._id}`);
                      }}
                    >
                      View Full Report
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>

                    {user?.role === 'admin' && (
                      <Button
                        variant="destructive"
                        className="w-full rounded-2xl"
                        onClick={(e) => handleArchiveClick(audit._id, e)}
                        disabled={archivingId === audit._id}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        {archivingId === audit._id ? 'Archiving...' : 'Archive'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredAudits.length > RESULTS_CONFIG.PAGINATION.ITEMS_PER_PAGE && (
              <Card className={cn(brandColors.surfaces.dashboardCard, 'bg-white/65')}>
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-slate-600">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredAudits.length)} of {filteredAudits.length} results
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-2xl border-white/60 bg-white/70 hover:bg-white"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                        const pageNum = currentPage <= 3 ? idx + 1 : currentPage + idx - 2;
                        if (pageNum > totalPages) return null;
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn(
                              'w-10 rounded-2xl',
                              currentPage === pageNum
                                ? 'bg-gradient-to-r from-violet-600 to-indigo-500 text-white hover:from-violet-500 hover:to-indigo-500'
                                : 'border-white/60 bg-white/70 hover:bg-white'
                            )}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      {totalPages > 5 && <span className="px-2 text-slate-600">...</span>}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-2xl border-white/60 bg-white/70 hover:bg-white"
                    >
                      Next
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </section>

      <ConfirmationDialog
        isOpen={archiveConfirmation.isOpen}
        title="Archive this audit?"
        description="This audit will be moved to the archive. You can restore it later from the Archive page. Archived audits are hidden from the main results list."
        confirmText="Archive"
        cancelText="Keep it"
        variant="warning"
        isLoading={archivingId !== null}
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveConfirmation({ isOpen: false, auditId: null })}
      />
    </div>
  );
}
