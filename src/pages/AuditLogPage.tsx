import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface AuditLogEntry {
  _id: string;
  auditUrl: string;
  status: string;
  agency?: string;
  createdAt: string;
  pst?: { found: boolean };
  transparencySeal?: { found: boolean };
}

export default function AuditLogPage() {
  const { token } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/audit`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
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
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh for 5 min
    gcTime: 30 * 60 * 1000, // 30 minutes - cached data persists for 30 min
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch on reconnect
  });

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

      {/* Audit Log Timeline */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-slate-600">Loading audit history...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs?.map((log: AuditLogEntry, index: number) => (
            <Card key={log._id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  {/* Timeline Icon */}
                  <div className="flex flex-col items-center">
                    {getStatusIcon(log.status)}
                    {index !== (logs.length - 1) && (
                      <div className="w-0.5 h-12 bg-slate-200 mt-2" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900 break-all">
                          {log.auditUrl}
                        </h3>
                        <p className="text-sm text-slate-600 mt-1">
                          {new Date(log.createdAt).toLocaleDateString()} at{' '}
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </p>
                        {log.agency && (
                          <p className="text-sm text-slate-600 mt-1">
                            Agency: <span className="font-medium">{log.agency}</span>
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={log.status === 'completed' ? 'default' : 'secondary'}
                        className="ml-2"
                      >
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </Badge>
                    </div>

                    {/* Quick Stats */}
                    {log.status === 'completed' && (
                      <div className="flex gap-4 mt-4 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`w-2 h-2 rounded-full ${log.pst?.found ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-slate-600">
                            PST: {log.pst?.found ? 'Found' : 'Missing'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`w-2 h-2 rounded-full ${log.transparencySeal?.found ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-slate-600">
                            Transparency: {log.transparencySeal?.found ? 'Found' : 'Missing'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
