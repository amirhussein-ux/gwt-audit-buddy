import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, Trash2, Search } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import ConfirmationDialog from '@/components/ConfirmationDialog';

/**
 * Archive page configuration
 */
const ARCHIVE_CONFIG = {
  API: {
    BASE: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
    ENDPOINTS: {
      ARCHIVE: '/audit/archive',
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
  PAGINATION: {
    ITEMS_PER_PAGE: 20,
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

interface ArchivedAudit {
  _id: string;
  auditUrl: string;
  status: string;
  agency?: { name: string; acronym: string };
  auditedBy?: { username: string; email: string };
  archivedBy?: { username: string; email: string };
  archivedAt: string;
  archiveReason?: string;
  createdAt: string;
}

export default function ArchivePage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.ALL);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState<{ isOpen: boolean; auditId: string | null }>({
    isOpen: false,
    auditId: null,
  });

  // Check authorization
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto py-8">
          <Button variant="outline" onClick={() => navigate('/')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-800">Access denied. Only administrators can view archived audits.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { data: archiveData, isLoading, error, refetch } = useQuery({
    queryKey: ['archived-audits'],
    queryFn: async () => {
      const response = await fetch(`${ARCHIVE_CONFIG.API.BASE}${ARCHIVE_CONFIG.API.ENDPOINTS.ARCHIVE}/list`, {
        headers: {
          [ARCHIVE_CONFIG.API.HEADERS.AUTHORIZATION]: `Bearer ${token}`,
          [ARCHIVE_CONFIG.API.HEADERS.CONTENT_TYPE]: ARCHIVE_CONFIG.API.HEADERS.CONTENT_TYPE_VALUE,
        },
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch archived audits');
      }
      return await response.json();
    },
    enabled: !!token,
    staleTime: ARCHIVE_CONFIG.QUERY.STALE_TIME,
    gcTime: ARCHIVE_CONFIG.QUERY.GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Filter and search logic
  const filteredArchives = useMemo(() => {
    if (!archiveData?.audits) return [];

    let filtered = archiveData.audits;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter((audit: ArchivedAudit) =>
        audit.auditUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (audit.agency?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    if (dateFilter !== ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.ALL) {
      filtered = filtered.filter((audit: ArchivedAudit) => {
        const archiveDate = new Date(audit.archivedAt);
        const archiveDateOnly = new Date(archiveDate.getFullYear(), archiveDate.getMonth(), archiveDate.getDate());

        if (dateFilter === ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.TODAY) {
          return archiveDateOnly.getTime() === today.getTime();
        } else if (dateFilter === ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.WEEK) {
          return archiveDateOnly >= weekAgo && archiveDateOnly <= today;
        } else if (dateFilter === ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.MONTH) {
          return archiveDateOnly >= monthAgo && archiveDateOnly <= today;
        }
        return true;
      });
    }

    return filtered;
  }, [archiveData?.audits, searchQuery, dateFilter]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredArchives.length / ARCHIVE_CONFIG.PAGINATION.ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ARCHIVE_CONFIG.PAGINATION.ITEMS_PER_PAGE;
  const endIndex = startIndex + ARCHIVE_CONFIG.PAGINATION.ITEMS_PER_PAGE;
  const paginatedArchives = filteredArchives.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const previousSearchQuery = useRef(searchQuery);
  useEffect(() => {
    if (searchQuery !== previousSearchQuery.current) {
      setCurrentPage(1);
      previousSearchQuery.current = searchQuery;
    }
  }, [searchQuery]);

  const handleRestoreClick = (auditId: string) => {
    setRestoreConfirmation({ isOpen: true, auditId });
  };

  const handleRestoreConfirm = async () => {
    if (!restoreConfirmation.auditId || !token) return;

    setIsRestoring(restoreConfirmation.auditId);
    try {
      const response = await fetch(`${ARCHIVE_CONFIG.API.BASE}/audit/${restoreConfirmation.auditId}/restore`, {
        method: 'POST',
        headers: {
          [ARCHIVE_CONFIG.API.HEADERS.AUTHORIZATION]: `Bearer ${token}`,
          [ARCHIVE_CONFIG.API.HEADERS.CONTENT_TYPE]: ARCHIVE_CONFIG.API.HEADERS.CONTENT_TYPE_VALUE,
        },
      });

      if (!response.ok) {
        const err = await response.json();
        alert(`Failed to restore: ${err.error}`);
        setRestoreConfirmation({ isOpen: false, auditId: null });
        return;
      }

      alert('Audit restored successfully');
      setRestoreConfirmation({ isOpen: false, auditId: null });
      refetch();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setRestoreConfirmation({ isOpen: false, auditId: null });
    } finally {
      setIsRestoring(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="outline" onClick={() => navigate('/')} className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-slate-900">Audit Archive</h1>
            <p className="text-slate-600 mt-2">
              Manage archived audit results (admin only)
            </p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-800">{error instanceof Error ? error.message : 'An error occurred'}</p>
            </CardContent>
          </Card>
        )}

        {/* Search and Filter Bar */}
        {archiveData?.audits && archiveData.audits.length > 0 && (
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by URL or agency..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
            >
              <option value={ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.ALL}>All Dates</option>
              <option value={ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.TODAY}>Today</option>
              <option value={ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.WEEK}>Last Week</option>
              <option value={ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.MONTH}>Last Month</option>
            </select>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && (!archiveData?.audits || archiveData.audits.length === 0) && (
          <Card className="border-2 border-dashed">
            <CardContent className="text-center py-12">
              <Trash2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No Archived Audits</h3>
              <p className="text-slate-600">Archive audits to manage them here</p>
            </CardContent>
          </Card>
        )}

        {/* No results after filtering */}
        {!isLoading && !error && archiveData?.audits && archiveData.audits.length > 0 && filteredArchives.length === 0 && (
          <Card className="border-2 border-dashed">
            <CardContent className="text-center py-12">
              <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No Results Found</h3>
              <p className="text-slate-600 mb-4">Try adjusting your search or filter criteria</p>
              <Button variant="outline" onClick={() => { setSearchQuery(''); setDateFilter(ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.ALL); }}>
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Archive Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <>
            {paginatedArchives.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Archived Date</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Auditor</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Agency</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Web URL</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Reason</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-900">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedArchives.map((audit: ArchivedAudit) => (
                          <tr key={audit._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="py-4 px-4 text-slate-600 text-xs">
                              {new Date(audit.archivedAt).toLocaleDateString()}
                            </td>
                            <td className="py-4 px-4 text-slate-900 font-medium text-sm">
                              {audit.auditedBy?.username || audit.auditedBy?.email || '—'}
                            </td>
                            <td className="py-4 px-4 text-slate-900">
                              {audit.agency?.name || '—'}
                            </td>
                            <td className="py-4 px-4 text-slate-600 max-w-xs truncate text-xs">
                              {audit.auditUrl}
                            </td>
                            <td className="py-4 px-4 text-slate-600 max-w-xs truncate text-xs">
                              {audit.archiveReason || '—'}
                            </td>
                            <td className="py-4 px-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestoreClick(audit._id)}
                                disabled={isRestoring === audit._id}
                                className="text-xs"
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                {isRestoring === audit._id ? 'Restoring...' : 'Restore'}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {filteredArchives.length > ARCHIVE_CONFIG.PAGINATION.ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                      <p className="text-sm text-slate-600">
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredArchives.length)} of {filteredArchives.length} archived audits
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-2">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <Button
                              key={page}
                              variant={currentPage === page ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Restore Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={restoreConfirmation.isOpen}
        title="Restore this audit?"
        description="This audit will be moved back to your main results list. It will no longer appear in the archive."
        confirmText="Restore"
        cancelText="Keep Archived"
        variant="success"
        isLoading={isRestoring !== null}
        onConfirm={handleRestoreConfirm}
        onCancel={() => setRestoreConfirmation({ isOpen: false, auditId: null })}
      />
    </div>
  );
}
