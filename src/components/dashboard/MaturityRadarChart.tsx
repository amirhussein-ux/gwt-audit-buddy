import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

interface MaturityData {
  agencies: Array<{
    _id: string;
    name: string;
    latestScore?: {
      webPresence?: {
        averageScore: number;
      };
      webUsability?: {
        accessibility: number;
      };
      overallScore: number;
    };
  }>;
}

export const MaturityRadarChart = () => {
  const { token } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  const { data, isLoading } = useQuery({
    queryKey: ['maturity-index'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/dashboard/maturity-index`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch maturity index');
      return response.json() as Promise<MaturityData>;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Maturity Index</CardTitle>
          <CardDescription>Web Presence vs. Accessibility vs. Content Quality</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  // Calculate average scores across all agencies
  const avgWebPresence =
    data?.agencies
      .filter((a) => a.latestScore?.webPresence?.averageScore)
      .reduce((sum, a) => sum + (a.latestScore?.webPresence?.averageScore || 0), 0) /
      (data?.agencies.filter((a) => a.latestScore?.webPresence?.averageScore).length || 1) || 0;

  const avgUsability =
    data?.agencies
      .filter((a) => a.latestScore?.webUsability?.accessibility)
      .reduce((sum, a) => sum + (a.latestScore?.webUsability?.accessibility || 0), 0) /
      (data?.agencies.filter((a) => a.latestScore?.webUsability?.accessibility).length || 1) || 0;

  const avgContent =
    data?.agencies?.filter((a) => a.latestScore?.overallScore).length || 1;

  // Simple radar visualization using text
  const getBar = (value: number) => {
    const filled = Math.round(value / 5);
    return '█'.repeat(filled) + '░'.repeat(20 - filled);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maturity Index</CardTitle>
        <CardDescription>Composite score from latest audits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Web Presence</span>
            <span className="text-sm font-bold text-blue-600">{avgWebPresence.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded h-3">
            <div className="bg-blue-600 h-3 rounded" style={{ width: `${avgWebPresence}%` }}></div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Web Usability</span>
            <span className="text-sm font-bold text-green-600">{avgUsability.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded h-3">
            <div className="bg-green-600 h-3 rounded" style={{ width: `${avgUsability}%` }}></div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Content Quality</span>
            <span className="text-sm font-bold text-purple-600">{avgContent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded h-3">
            <div className="bg-purple-600 h-3 rounded" style={{ width: `${(avgContent / 100) * 100}%` }}></div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-slate-600">
            Based on latest audits from government agencies
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
