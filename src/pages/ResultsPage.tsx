import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ArrowRight, Search, Calendar } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Results page configuration
 * Contains API settings, query caching, pagination, and storage keys
 */
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
    STALE_TIME: 5 * 60 * 1000, // 5 minutes
    GC_TIME: 30 * 60 * 1000, // 30 minutes
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
  const { token } = useAuth();
  
  // State for audit completion modal
  const [completedAuditId, setCompletedAuditId] = useState<string | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(RESULTS_CONFIG.FILTERS.DATE_OPTIONS.ALL);
  const [currentPage, setCurrentPage] = useState(1);

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
      // The endpoint returns { audits, total, skip, limit }
      return result.audits || [];
    },
    enabled: !!token, // Only run if we have a token
    staleTime: RESULTS_CONFIG.QUERY.STALE_TIME,
    gcTime: RESULTS_CONFIG.QUERY.GC_TIME,
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
        console.log('[ResultsPage] Audit completed, showing modal:', customEvent.detail.auditLogId);
      }
    };

    // Listen for custom audit completion event
    window.addEventListener('auditCompleted', handleAuditComplete);
    
    // Also listen for storage changes from other tabs/windows
    const handleStorageChange = () => {
      const completedAudit = localStorage.getItem(RESULTS_CONFIG.STORAGE.COMPLETED_AUDIT);
      if (completedAudit) {
        try {
          const auditData = JSON.parse(completedAudit);
          setCompletedAuditId(auditData.auditLogId);
          setShowCompletionModal(true);
          console.log('[ResultsPage] Audit completed (from other tab), showing modal:', auditData.auditLogId);
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
      localStorage.removeItem(RESULTS_CONFIG.STORAGE.COMPLETED_AUDIT);
      setShowCompletionModal(false);
      navigate(`${RESULTS_CONFIG.ROUTES.AUDIT}/${completedAuditId}`);
    }
  };


  // Filter and search logic
  const filteredAudits = useMemo(() => {
    if (!audits) return [];

    let filtered = audits;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter((audit: AuditResult) =>
        audit.auditUrl.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply date filter
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

  // Calculate pagination
  const totalPages = Math.ceil(filteredAudits.length / RESULTS_CONFIG.PAGINATION.ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * RESULTS_CONFIG.PAGINATION.ITEMS_PER_PAGE;
  const endIndex = startIndex + RESULTS_CONFIG.PAGINATION.ITEMS_PER_PAGE;
  const paginatedAudits = filteredAudits.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFilter]);
  const handleStayOnPage = () => {
    localStorage.removeItem(RESULTS_CONFIG.STORAGE.COMPLETED_AUDIT);
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

      <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Web Accessibility Audit Results</h1>
        <p className="text-slate-600 mt-2">
          Browse and review previous audit results
        </p>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error instanceof Error ? error.message : 'Failed to load audits'}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter Bar */}
      {audits && audits.length > 0 && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 rounded-md border border-slate-200 bg-white text-slate-900 text-sm font-medium hover:bg-slate-50 flex items-center gap-2"
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
      {!isLoading && !error && (!audits || audits.length === 0) && (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Audit Results Yet</h3>
              <p className="text-slate-600 mb-6">
                Run your first audit from the Dashboard to see results here
              </p>
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No results after filtering */}
      {!isLoading && !error && audits && audits.length > 0 && filteredAudits.length === 0 && (
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
                  setDateFilter(RESULTS_CONFIG.FILTERS.DATE_OPTIONS.ALL);
                }}
              >
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-slate-600">Loading audit results...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paginatedAudits?.map((audit: AuditResult) => (
              <Card
                key={audit._id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/audit/${audit._id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg truncate">{audit.auditUrl}</CardTitle>
                      <CardDescription className="mt-1">
                        {new Date(audit.createdAt).toLocaleDateString()} at{' '}
                        {new Date(audit.createdAt).toLocaleTimeString()}
                      </CardDescription>
                    </div>
                    <Badge variant={audit.status === 'completed' ? 'default' : 'secondary'}>
                      {audit.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-slate-50 rounded">
                      <p className="text-xs text-slate-600">PST</p>
                      <p className="text-lg font-bold text-slate-900">
                        {audit.pst?.found ? '✓' : '✗'}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded">
                      <p className="text-xs text-slate-600">Transparency Seal</p>
                      <p className="text-lg font-bold text-slate-900">
                        {audit.transparencySeal?.found ? '✓' : '✗'}
                      </p>
                    </div>
                  </div>

                  {/* Evaluations Performed */}
                  <div className="pt-2 border-t">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Evaluations Performed:</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">Web Presence</Badge>
                      <Badge variant="secondary" className="text-xs">Web Usability</Badge>
                      <Badge variant="secondary" className="text-xs">Performance</Badge>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/audit/${audit._id}`);
                    }}
                  >
                    View Full Report
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {filteredAudits.length > RESULTS_CONFIG.PAGINATION.ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between pt-6 border-t">
              <div className="text-sm text-slate-600">
                Showing {startIndex + 1}–{Math.min(endIndex, filteredAudits.length)} of {filteredAudits.length} results
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
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
                        className="w-10"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  {totalPages > 5 && (
                    <span className="px-2 text-slate-600">...</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
