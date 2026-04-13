import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  agency: {
    _id: string;
    name: string;
    acronym: string;
  };
  overallScore: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  count: number;
}

export const AgencyLeaderboard = () => {
  const { token } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/dashboard/leaderboard?limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return response.json() as Promise<LeaderboardData>;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>Top Agencies</CardTitle>
          <CardDescription>Compliance leaderboard</CardDescription>
        </CardHeader>
        <CardContent className="h-96 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  const chartData = (data?.leaderboard || []).map((entry) => ({
    name: entry.agency.acronym || entry.agency.name.split(' ')[0],
    score: entry.overallScore,
    rank: entry.rank,
  }));

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-orange-600" />;
    return null;
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800';
    if (score >= 70) return 'bg-blue-100 text-blue-800';
    if (score >= 55) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Agencies</CardTitle>
        <CardDescription>Highest compliance scores</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {chartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Bar dataKey="score" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>

            <div className="space-y-2 mt-6 max-h-40 overflow-y-auto">
              {(data?.leaderboard || []).slice(0, 5).map((entry) => (
                <div key={entry.agency._id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <div className="flex items-center gap-2">
                    {getMedalIcon(entry.rank)}
                    <span className="font-medium">{entry.rank}.</span>
                    <div>
                      <p className="font-medium text-sm">{entry.agency.name}</p>
                      <p className="text-xs text-slate-500">{entry.agency.acronym}</p>
                    </div>
                  </div>
                  <Badge className={getScoreBadgeColor(entry.overallScore)}>
                    {entry.overallScore.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-500">
            No leaderboard data available
          </div>
        )}
      </CardContent>
    </Card>
  );
};
