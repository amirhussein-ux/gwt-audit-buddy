import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ComplianceScoreData {
  data: Record<string, Array<{
    _id: string;
    overallScore: number;
    createdAt: string;
  }>>;
  period: string;
}

export const ComplianceTrendChart = () => {
  const { token } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  const { data, isLoading } = useQuery({
    queryKey: ['compliance-trend'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/dashboard/compliance-trend?days=90`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch compliance trend');
      return response.json() as Promise<ComplianceScoreData>;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Compliance Trend</CardTitle>
          <CardDescription>Score improvements over time</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  // Flatten data for chart (average overall scores per day)
  const chartData: Array<{ date: string; average: number }> = [];

  if (data?.data && typeof data.data === 'object') {
    const allScores: Record<string, number[]> = {};

    Object.values(data.data).forEach((agencyScores: any[]) => {
      agencyScores.forEach((score) => {
        const date = new Date(score.createdAt).toLocaleDateString();
        if (!allScores[date]) allScores[date] = [];
        allScores[date].push(score.overallScore);
      });
    });

    Object.entries(allScores).forEach(([date, scores]) => {
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      chartData.push({ date, average });
    });
  }

  // Sort by date
  chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Compliance Trend</CardTitle>
        <CardDescription>Average system-wide compliance over {data?.period}</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(1)}%`}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="average"
                stroke="#2563eb"
                dot={false}
                isAnimationActive={true}
                name="Average Compliance"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500">
            No trend data available yet
          </div>
        )}
      </CardContent>
    </Card>
  );
};
