import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Download, TrendingUp, Award, AlertCircle, Info } from 'lucide-react';
import { generatePDF } from '@/utils/pdfExport';

interface ComplianceScoreData {
  data: Record<string, Array<{
    _id: string;
    overallScore: number;
    createdAt: string;
  }>>;
  period: string;
}

interface TimeRange {
  label: string;
  days: number;
}

interface ChartDataPoint {
  date: string;
  average: number;
  formatted: string;
}

interface Statistics {
  current: number;
  highest: number;
  lowest: number;
  average: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  insight: string;
}

const TIME_RANGES: Record<string, TimeRange> = {
  day: { label: 'Last Day', days: 1 },
  monthly: { label: 'Last Month', days: 30 },
  quarterly: { label: 'Last Quarter', days: 90 },
  yearly: { label: 'Last Year', days: 365 },
};

// Status color mapping
const getStatusColor = (score: number): { bg: string; text: string; status: string } => {
  if (score >= 80) return { bg: 'bg-green-50', text: 'text-green-700', status: 'Excellent' };
  if (score >= 50) return { bg: 'bg-yellow-50', text: 'text-yellow-700', status: 'Moderate' };
  return { bg: 'bg-red-50', text: 'text-red-700', status: 'Needs Improvement' };
};

// Format date to readable format (e.g., "Jan 15, 2026")
const formatDateReadable = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Calculate trend statistics
const calculateStatistics = (data: ChartDataPoint[]): Statistics => {
  if (data.length === 0) {
    return { current: 0, highest: 0, lowest: 0, average: 0, change: 0, trend: 'stable', insight: '' };
  }

  const scores = data.map(d => d.average);
  const current = scores[scores.length - 1];
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Calculate change from first to last
  const first = scores[0];
  const change = ((current - first) / first) * 100;
  const trend = change > 2 ? 'up' : change < -2 ? 'down' : 'stable';

  // Generate insight
  let insight = '';
  if (trend === 'up' && change > 10) {
    insight = `Strong improvement! Compliance has increased by ${change.toFixed(1)}% over this period.`;
  } else if (trend === 'up') {
    insight = `Steady progress. Compliance has improved by ${change.toFixed(1)}% over this period.`;
  } else if (trend === 'down' && Math.abs(change) > 10) {
    insight = `Attention needed. Compliance has decreased by ${Math.abs(change).toFixed(1)}% over this period.`;
  } else if (trend === 'down') {
    insight = `Minor decline. Compliance has decreased by ${Math.abs(change).toFixed(1)}% over this period.`;
  } else {
    insight = `Stable performance. Compliance scores have remained consistent over this period.`;
  }

  return { current, highest, lowest, average, change, trend, insight };
};

export const ComplianceTrendChart = () => {
  const { token } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
  const [selectedRange, setSelectedRange] = useState<string>('quarterly');
  const chartRef = useRef<HTMLDivElement>(null);
  const [showGuide, setShowGuide] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['compliance-trend', selectedRange],
    queryFn: async () => {
      const days = TIME_RANGES[selectedRange].days;
      const response = await fetch(`${API_BASE}/dashboard/compliance-trend?days=${days}`, {
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
          <CardDescription>Analyzing compliance performance over time</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  // Flatten data for chart (average overall scores per day)
  const chartData: ChartDataPoint[] = [];

  if (data?.data && typeof data.data === 'object') {
    const allScores: Record<string, number[]> = {};

    Object.values(data.data).forEach((agencyScores: Array<{ _id: string; overallScore: number; createdAt: string }>) => {
      agencyScores.forEach((score) => {
        const date = new Date(score.createdAt).toLocaleDateString();
        if (!allScores[date]) allScores[date] = [];
        allScores[date].push(score.overallScore);
      });
    });

    Object.entries(allScores).forEach(([date, scores]) => {
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      chartData.push({ date, average, formatted: formatDateReadable(date) });
    });
  }

  // Sort by date
  chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const statistics = calculateStatistics(chartData);
  const statusInfo = getStatusColor(statistics.current);

  // Function to download chart as PDF
  const handleDownloadPDF = async () => {
    try {
      if (!chartRef.current) return;

      const filename = `compliance-trend-${selectedRange}-${new Date().toISOString().split('T')[0]}.pdf`;
      await generatePDF(chartRef.current, filename, {
        period: TIME_RANGES[selectedRange].label,
        statistics,
        insight: statistics.insight,
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Compliance Trend Report
            </CardTitle>
            <CardDescription>Performance tracking across all agencies</CardDescription>
          </div>
          <Button
            onClick={handleDownloadPDF}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Report
          </Button>
        </div>

        {/* Time Range Filters */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {Object.entries(TIME_RANGES).map(([key, range]) => (
            <Button
              key={key}
              onClick={() => setSelectedRange(key)}
              variant={selectedRange === key ? 'default' : 'outline'}
              size="sm"
            >
              {range.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Plain Language Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            <span className="font-semibold">📊 Summary:</span> {statistics.insight}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Current Score */}
          <div className={`rounded-lg p-4 ${statusInfo.bg}`}>
            <p className="text-xs text-slate-600 font-medium mb-1">Current Score</p>
            <p className={`text-2xl font-bold ${statusInfo.text}`}>
              {statistics.current.toFixed(1)}%
            </p>
            <p className={`text-xs ${statusInfo.text} mt-1`}>{statusInfo.status}</p>
          </div>

          {/* Highest Score */}
          <div className="rounded-lg p-4 bg-emerald-50 border border-emerald-200">
            <p className="text-xs text-slate-600 font-medium mb-1">Highest Score</p>
            <p className="text-2xl font-bold text-emerald-700">
              {statistics.highest.toFixed(1)}%
            </p>
            <p className="text-xs text-emerald-600 mt-1">Peak performance</p>
          </div>

          {/* Lowest Score */}
          <div className="rounded-lg p-4 bg-orange-50 border border-orange-200">
            <p className="text-xs text-slate-600 font-medium mb-1">Lowest Score</p>
            <p className="text-2xl font-bold text-orange-700">
              {statistics.lowest.toFixed(1)}%
            </p>
            <p className="text-xs text-orange-600 mt-1">Minimum recorded</p>
          </div>

          {/* Change Indicator */}
          <div className={`rounded-lg p-4 ${statistics.trend === 'up' ? 'bg-green-50 border border-green-200' : statistics.trend === 'down' ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
            <p className="text-xs text-slate-600 font-medium mb-1">Progress</p>
            <p className={`text-2xl font-bold ${
              statistics.trend === 'up' ? 'text-green-700' : statistics.trend === 'down' ? 'text-red-700' : 'text-slate-700'
            }`}>
              {statistics.change > 0 ? '+' : ''}{statistics.change.toFixed(1)}%
            </p>
            <p className={`text-xs ${
              statistics.trend === 'up' ? 'text-green-600' : statistics.trend === 'down' ? 'text-red-600' : 'text-slate-600'
            } mt-1`}>
              {statistics.trend === 'up' ? '📈 Improving' : statistics.trend === 'down' ? '📉 Declining' : '➡️ Stable'}
            </p>
          </div>
        </div>

        {/* Color Legend */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-slate-700">Score Legend:</span>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Info className="h-3 w-3" /> Learn more
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-400"></div>
              <span className="text-xs text-slate-600">Excellent (80-100%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-400"></div>
              <span className="text-xs text-slate-600">Moderate (50-79%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-400"></div>
              <span className="text-xs text-slate-600">Needs Work (&lt;50%)</span>
            </div>
          </div>
        </div>

        {/* Educational Guide (Expandable) */}
        {showGuide && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <Award className="h-4 w-4" /> Understanding Compliance
            </h4>
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <strong>What is Compliance?</strong> A measure of how well government websites meet digital standards for accessibility, functionality, and user experience.
              </p>
              <p>
                <strong>Why does it matter?</strong> Better compliance ensures citizens can easily access government services online, regardless of ability or technology used.
              </p>
              <p>
                <strong>How to interpret:</strong>
                <ul className="list-disc list-inside mt-1 ml-2">
                  <li>80%+ = Excellent digital experience for most users</li>
                  <li>50-79% = Good foundation but room for improvement</li>
                  <li>&lt;50% = Significant work needed to meet standards</li>
                </ul>
              </p>
            </div>
          </div>
        )}

        {/* Chart Section */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-semibold mb-4 text-slate-900">Performance Trend</h3>
          <div ref={chartRef} className="bg-white rounded-lg">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="formatted" 
                    tick={{ fontSize: 12 }}
                    angle={chartData.length > 30 ? -45 : 0}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      padding: '10px',
                    }}
                    formatter={(value: number) => [
                      `${value.toFixed(1)}% - ${
                        value >= 80 ? 'Excellent' : value >= 50 ? 'Moderate' : 'Needs Improvement'
                      }`,
                      'Compliance Score',
                    ]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <ReferenceLine 
                    y={80} 
                    stroke="#22c55e" 
                    strokeDasharray="5 5" 
                    label={{ value: 'Excellent (80%)', position: 'left', fill: '#22c55e', fontSize: 11 }} 
                  />
                  <ReferenceLine 
                    y={50} 
                    stroke="#f59e0b" 
                    strokeDasharray="5 5" 
                    label={{ value: 'Threshold (50%)', position: 'left', fill: '#f59e0b', fontSize: 11 }} 
                  />
                  <Line
                    type="monotone"
                    dataKey="average"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={true}
                    name="Average Compliance Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                <AlertCircle className="h-5 w-5 mr-2" />
                No trend data available yet
              </div>
            )}
          </div>
        </div>

        {/* Additional Insights */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-indigo-900 mb-2">💡 Recommendation</p>
          <p className="text-sm text-indigo-800">
            {statistics.current >= 80
              ? 'Great work! Focus on maintaining these standards and exploring advanced accessibility features.'
              : statistics.current >= 50
              ? 'Good progress. Prioritize fixing high-impact issues to reach the "Excellent" threshold of 80%.'
              : 'Significant opportunity for improvement. Consider conducting a full accessibility audit and creating an improvement roadmap.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
