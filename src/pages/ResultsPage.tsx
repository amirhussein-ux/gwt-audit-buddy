import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

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
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  const { data: audits, isLoading, error } = useQuery({
    queryKey: ['audits'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/audit`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
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
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh for 5 min
    gcTime: 30 * 60 * 1000, // 30 minutes - cached data persists for 30 min
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch on reconnect
  });

  return (
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

      {/* Results Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-slate-600">Loading audit results...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {audits?.map((audit: AuditResult) => (
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
      )}
    </div>
  );
}
