import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, RotateCcw, Trash2, Search } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { MultiSelectToolbar } from '@/components/MultiSelectToolbar';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states';
import { useToast } from '@/hooks/use-toast';

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
    STALE_TIME: 5 * 60 * 1000,
    GC_TIME: 30 * 60 * 1000,
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
    STATUS_ALL: 'all',
  },
};

interface ArchivedAudit {
  _id: string;
  auditUrl: string;
  status: string;
  agency?: { name: string; acronym: string; tags?: string[] };
  auditedBy?: { username: string; email: string };
  archivedBy?: { username: string; email: string };
  archivedAt: string;
  archiveReason?: string;
  createdAt: string;
}

export default function ArchivePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.ALL);
  const [statusFilter, setStatusFilter] = useState(ARCHIVE_CONFIG.FILTERS.STATUS_ALL);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectionEnabled, setSelectionEnabled] = useState(false);
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([]);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isBulkRestoring, setIsBulkRestoring] = useState(false);
  const [restoreConfirmation, setRestoreConfirmation] = useState<{ isOpen: boolean; auditIds: string[] }>({
    isOpen: false,
    auditIds: [],
  });

  const isAdmin = user?.role === 'admin';

  const { data: archiveData, isLoading, error, refetch, isFetching } = useQuery({
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

  const getStatusGroup = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === 'success' || normalizedStatus === 'completed') return 'success';
    if (normalizedStatus === 'cancelled' || normalizedStatus === 'canceled') return 'cancelled';
    if (normalizedStatus === 'failed') return 'failed';
    return normalizedStatus;
  };

  const filteredArchives = useMemo(() => {
    if (!archiveData?.audits) return [];

    let filtered = archiveData.audits;

    if (searchQuery.trim()) {
      filtered = filtered.filter((audit: ArchivedAudit) =>
        audit.auditUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (audit.agency?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== ARCHIVE_CONFIG.FILTERS.STATUS_ALL) {
      filtered = filtered.filter((audit: ArchivedAudit) => getStatusGroup(audit.status) === statusFilter);
    }

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
        }
        if (dateFilter === ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.WEEK) {
          return archiveDateOnly >= weekAgo && archiveDateOnly <= today;
        }
        if (dateFilter === ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.MONTH) {
          return archiveDateOnly >= monthAgo && archiveDateOnly <= today;
        }
        return true;
      });
    }

    return filtered;
  }, [archiveData?.audits, searchQuery, dateFilter, statusFilter]);

  const totalPages = Math.ceil(filteredArchives.length / ARCHIVE_CONFIG.PAGINATION.ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ARCHIVE_CONFIG.PAGINATION.ITEMS_PER_PAGE;
  const endIndex = startIndex + ARCHIVE_CONFIG.PAGINATION.ITEMS_PER_PAGE;
  const paginatedArchives = filteredArchives.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFilter, statusFilter]);

  const toggleSelectedAudit = (auditId: string) => {
    setSelectedAuditIds((prev) =>
      prev.includes(auditId) ? prev.filter((id) => id !== auditId) : [...prev, auditId]
    );
  };

  const handleRestoreClick = (auditId: string) => {
    setRestoreConfirmation({ isOpen: true, auditIds: [auditId] });
  };

  const handleBulkRestoreClick = () => {
    setRestoreConfirmation({ isOpen: true, auditIds: selectedAuditIds });
  };

  const handleRestoreConfirm = async () => {
    if (restoreConfirmation.auditIds.length === 0 || !token) return;

    const isBulk = restoreConfirmation.auditIds.length > 1;
    if (isBulk) {
      setIsBulkRestoring(true);
    } else {
      setIsRestoring(restoreConfirmation.auditIds[0]);
    }

    try {
      const response = await fetch(`${ARCHIVE_CONFIG.API.BASE}/audit/restore/bulk`, {
        method: 'POST',
        headers: {
          [ARCHIVE_CONFIG.API.HEADERS.AUTHORIZATION]: `Bearer ${token}`,
          [ARCHIVE_CONFIG.API.HEADERS.CONTENT_TYPE]: ARCHIVE_CONFIG.API.HEADERS.CONTENT_TYPE_VALUE,
        },
        body: JSON.stringify({ auditIds: restoreConfirmation.auditIds }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to restore audit');
      }

      await queryClient.invalidateQueries({ queryKey: ['archived-audits'] });
      await queryClient.invalidateQueries({ queryKey: ['audits'] });
      setSelectedAuditIds((prev) => prev.filter((id) => !restoreConfirmation.auditIds.includes(id)));
      setRestoreConfirmation({ isOpen: false, auditIds: [] });
    } catch (restoreError) {
      toast({
        variant: 'destructive',
        title: 'Restore failed',
        description: restoreError instanceof Error ? restoreError.message : 'The audit could not be restored.',
      });
      setRestoreConfirmation({ isOpen: false, auditIds: [] });
    } finally {
      setIsRestoring(null);
      setIsBulkRestoring(false);
    }
  };

  const filterInputClassName =
    'h-11 rounded-2xl border-white/70 bg-white/78 pl-10 shadow-[0_10px_24px_rgba(148,163,184,0.08)] backdrop-blur-md';
  const filterSelectClassName =
    'h-11 rounded-2xl border border-white/70 bg-white/78 px-4 text-sm font-medium text-slate-700 shadow-[0_10px_24px_rgba(148,163,184,0.08)] backdrop-blur-md transition-colors hover:bg-white';

  return (
    <div className={cn('min-h-full space-y-8 py-8', brandColors.appShell.contentPadding)}>
      {!isAdmin ? (
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
      ) : (
        <>

      {archiveData?.audits?.length > 0 ? (
        <MultiSelectToolbar
          title="Restore Multiple Archived Audits"
          selectedCount={selectedAuditIds.length}
          totalCount={filteredArchives.length}
          selectionEnabled={selectionEnabled}
          isBusy={isBulkRestoring}
          onToggleSelection={() => {
            setSelectionEnabled((prev) => !prev);
            if (selectionEnabled) {
              setSelectedAuditIds([]);
            }
          }}
          onSelectAll={() => setSelectedAuditIds(filteredArchives.map((audit: ArchivedAudit) => audit._id))}
          onClear={() => setSelectedAuditIds([])}
          primaryActionLabel="Restore Selected"
          onPrimaryAction={handleBulkRestoreClick}
        />
      ) : null}

      {error && (
        <ErrorState
          title="Archived audits are unavailable"
          description={error instanceof Error ? error.message : 'An error occurred while loading archived audits.'}
          onRetry={() => void refetch()}
          retryLabel={isFetching ? 'Retrying...' : 'Retry archive'}
          isRetrying={isFetching}
        />
      )}

      {archiveData?.audits && archiveData.audits.length > 0 && (
        <Card className={cn(brandColors.surfaces.dashboardCard, 'bg-white/65')}>
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:flex-wrap md:items-center">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by URL or agency..."
                className={filterInputClassName}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className={filterSelectClassName}
              >
                <option value={ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.ALL}>All Dates</option>
                <option value={ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.TODAY}>Today</option>
                <option value={ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.WEEK}>Last Week</option>
                <option value={ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.MONTH}>Last Month</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={filterSelectClassName}
              >
                <option value={ARCHIVE_CONFIG.FILTERS.STATUS_ALL}>All Statuses</option>
                <option value="success">Success</option>
                <option value="cancelled">Cancelled</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (!archiveData?.audits || archiveData.audits.length === 0) && (
        <EmptyState
          title="No archived audits"
          description="Archive audits to manage them here."
          icon={<Trash2 className="h-6 w-6" />}
        />
      )}

      {!isLoading && !error && archiveData?.audits && archiveData.audits.length > 0 && filteredArchives.length === 0 && (
        <EmptyState
          title="No results found"
          description="Try adjusting your search, date, or status filters."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery('');
            setDateFilter(ARCHIVE_CONFIG.FILTERS.DATE_OPTIONS.ALL);
            setStatusFilter(ARCHIVE_CONFIG.FILTERS.STATUS_ALL);
          }}
          icon={<Search className="h-6 w-6" />}
        />
      )}

      {isLoading ? (
        <TableSkeleton
          title="Archived Audits"
          description="Loading the archive list."
          columns={6}
        />
      ) : paginatedArchives.length > 0 ? (
        <Card className={brandColors.surfaces.dashboardCard}>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="w-14 px-4 py-3 text-left font-semibold text-slate-900">Select</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Archived Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Auditor</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Agency</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Tags</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Web URL</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Reason</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-900">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedArchives.map((audit: ArchivedAudit) => {
                    const isSelected = selectedAuditIds.includes(audit._id);
                    return (
                      <tr
                        key={audit._id}
                        className={cn(
                          'border-b border-slate-100 transition-colors hover:bg-slate-50',
                          isSelected && 'bg-violet-50/60'
                        )}
                      >
                        <td className="px-4 py-4">
                          {selectionEnabled ? (
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectedAudit(audit._id)} />
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-600">
                          {new Date(audit.archivedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-900">
                          {audit.auditedBy?.username || audit.auditedBy?.email || '-'}
                        </td>
                        <td className="px-4 py-4 text-slate-900">
                          {audit.agency?.name || '-'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {(audit.agency?.tags || []).length > 0 ? (
                              (audit.agency?.tags || []).map((tag) => (
                                <Badge key={tag} variant="secondary" className="rounded-full bg-sky-100 text-sky-700 hover:bg-sky-100">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">No tags</span>
                            )}
                          </div>
                        </td>
                        <td className="max-w-xs truncate px-4 py-4 text-xs text-slate-600">
                          {audit.auditUrl}
                        </td>
                        <td className="max-w-xs truncate px-4 py-4 text-xs text-slate-600">
                          {audit.archiveReason || '-'}
                        </td>
                        <td className="px-4 py-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreClick(audit._id)}
                            disabled={isRestoring === audit._id || isBulkRestoring}
                            className="text-xs"
                          >
                            <RotateCcw className="mr-1 h-3 w-3" />
                            {isRestoring === audit._id ? 'Restoring...' : 'Restore'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredArchives.length > ARCHIVE_CONFIG.PAGINATION.ITEMS_PER_PAGE && (
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
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
      ) : null}

          <ConfirmationDialog
            isOpen={restoreConfirmation.isOpen}
            title={restoreConfirmation.auditIds.length > 1 ? 'Restore selected audits?' : 'Restore this audit?'}
            description={
              restoreConfirmation.auditIds.length > 1
                ? 'These audits will be moved back to the main results list and will no longer appear in the archive.'
                : 'This audit will be moved back to your main results list. It will no longer appear in the archive.'
            }
            confirmText={restoreConfirmation.auditIds.length > 1 ? 'Restore Selected' : 'Restore'}
            cancelText="Keep Archived"
            variant="success"
            isLoading={isRestoring !== null || isBulkRestoring}
            onConfirm={handleRestoreConfirm}
            onCancel={() => setRestoreConfirmation({ isOpen: false, auditIds: [] })}
          />
        </>
      )}
    </div>
  );
}
