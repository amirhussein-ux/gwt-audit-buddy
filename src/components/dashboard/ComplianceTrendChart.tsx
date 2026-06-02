import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, CartesianGrid } from 'recharts';
import { Download, TrendingUp, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generatePDF } from '@/utils/pdfExport';
import { InfoBubble } from '@/components/InfoBubble';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';
import { ChartSkeleton, EmptyState, ErrorState } from '@/components/states';

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

const COMPLIANCE_TREND_CONFIG = {
  CHART_COLS: 'grid-cols-2 md:grid-cols-4',
  LEGEND_COLS: 'grid-cols-3',
  TREND_THRESHOLD_SIGNIFICANT: 10,
  TREND_THRESHOLD_MINOR: 2,
};

const TIME_RANGES: Record<string, TimeRange> = {
  day: { label: 'Last Day', days: 1 },
  monthly: { label: 'Last Month', days: 30 },
  quarterly: { label: 'Last Quarter', days: 90 },
  yearly: { label: 'Last Year', days: 365 },
};

const STATUS_COLORS_CONFIG = {
  excellent: { bg: 'bg-green-50', text: 'text-green-700', status: 'Excellent', threshold: 80 },
  moderate: { bg: 'bg-yellow-50', text: 'text-yellow-700', status: 'Moderate', threshold: 50 },
  needsImprovement: { bg: 'bg-red-50', text: 'text-red-700', status: 'Needs Improvement', threshold: 0 },
};

const LEGEND_ITEMS = [
  { color: 'bg-green-400', label: 'Excellent (80-100%)' },
  { color: 'bg-yellow-400', label: 'Moderate (50-79%)' },
  { color: 'bg-red-400', label: 'Needs Work (<50%)' },
];

const EDUCATION_CONTENT = {
  title: 'Understanding Compliance Trend',
  summary: 'This report tracks whether overall government website compliance is improving, flattening, or slipping across recent audits.',
  sections: [
    {
      title: 'What it measures',
      body: 'The chart averages compliance scores over time so you can quickly spot direction, not just one isolated audit result.',
    },
    {
      title: 'How to use it',
      body: 'Use rising trends to confirm that fixes are working. Use flat or declining trends to prioritize follow-up audits and support.',
    },
  ],
};

const getStatusColor = (score: number) => {
  if (score >= STATUS_COLORS_CONFIG.excellent.threshold) {
    return STATUS_COLORS_CONFIG.excellent;
  }
  if (score >= STATUS_COLORS_CONFIG.moderate.threshold) {
    return STATUS_COLORS_CONFIG.moderate;
  }
  return STATUS_COLORS_CONFIG.needsImprovement;
};

const formatDateReadable = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getTrendInsight = (change: number, trend: 'up' | 'down' | 'stable'): string => {
  if (trend === 'up' && change > COMPLIANCE_TREND_CONFIG.TREND_THRESHOLD_SIGNIFICANT) {
    return `Strong improvement. Compliance has increased by ${change.toFixed(1)}% over this period.`;
  }
  if (trend === 'up') {
    return `Steady progress. Compliance has improved by ${change.toFixed(1)}% over this period.`;
  }
  if (trend === 'down' && Math.abs(change) > COMPLIANCE_TREND_CONFIG.TREND_THRESHOLD_SIGNIFICANT) {
    return `Attention needed. Compliance has decreased by ${Math.abs(change).toFixed(1)}% over this period.`;
  }
  if (trend === 'down') {
    return `Minor decline. Compliance has decreased by ${Math.abs(change).toFixed(1)}% over this period.`;
  }
  return 'Stable performance. Compliance scores have remained consistent over this period.';
};

const calculateStatistics = (data: ChartDataPoint[]): Statistics => {
  if (data.length === 0) {
    return { current: 0, highest: 0, lowest: 0, average: 0, change: 0, trend: 'stable', insight: '' };
  }

  const scores = data.map((entry) => entry.average);
  const current = scores[scores.length - 1];
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const first = scores[0];
  const change = first === 0 ? 0 : ((current - first) / first) * 100;
  const trend = change > COMPLIANCE_TREND_CONFIG.TREND_THRESHOLD_MINOR ? 'up' : change < -COMPLIANCE_TREND_CONFIG.TREND_THRESHOLD_MINOR ? 'down' : 'stable';
  const insight = getTrendInsight(change, trend);

  return { current, highest, lowest, average, change, trend, insight };
};

interface TrendStatCardProps {
  label: string;
  value: string;
  textColor: string;
  bgColor: string;
  description: string;
}

const TrendStatCard = ({ label, value, textColor, bgColor, description }: TrendStatCardProps) => (
  <div className={`rounded-lg p-4 ${bgColor}`}>
    <p className="mb-1 text-xs font-medium text-slate-600">{label}</p>
    <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
    <p className={`mt-1 text-xs ${textColor}`}>{description}</p>
  </div>
);

const ColorLegendItem = ({ color, label }: { color: string; label: string }) => (
  <div className="flex items-center gap-2">
    <div className={`h-4 w-4 rounded ${color}`} />
    <span className="text-xs text-slate-600">{label}</span>
  </div>
);

export const ComplianceTrendChart = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
  const [selectedRange, setSelectedRange] = useState<string>('quarterly');
  const cardRef = useRef<HTMLDivElement | null>(null);
  const selectedTimeRange = TIME_RANGES[selectedRange] ?? TIME_RANGES.quarterly;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['compliance-trend', selectedRange],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/dashboard/compliance-trend?days=${selectedTimeRange.days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        throw new Error('Unable to load the compliance trend right now. Please refresh the page.');
      }
      if (!response.ok) throw new Error('Failed to fetch compliance trend');
      return response.json().catch(() => ({ data: {}, period: selectedRange })) as Promise<ComplianceScoreData>;
    },
    enabled: !!token,
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message.includes('Unable to load the compliance trend right now')) {
        return false;
      }
      return failureCount < 2;
    },
  });

  if (isLoading) {
    return <ChartSkeleton title="Compliance Trend Report" description="Performance tracking across all agencies" className="col-span-2" />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Trend data is unavailable"
        description={error instanceof Error ? error.message : 'The compliance trend report could not be loaded right now.'}
        onRetry={() => void refetch()}
        retryLabel={isFetching ? 'Retrying...' : 'Retry'}
        isRetrying={isFetching}
        className="col-span-2"
      />
    );
  }

  const chartData: ChartDataPoint[] = [];
  if (data?.data && typeof data.data === 'object') {
    const allScores: Record<string, number[]> = {};

    Object.values(data.data).forEach((agencyScores) => {
      if (!Array.isArray(agencyScores)) {
        return;
      }

      agencyScores.forEach((score) => {
        const parsedDate = new Date(score.createdAt);
        if (Number.isNaN(parsedDate.getTime()) || !Number.isFinite(score.overallScore)) {
          return;
        }

        const date = parsedDate.toISOString().split('T')[0];
        if (!allScores[date]) allScores[date] = [];
        allScores[date].push(score.overallScore);
      });
    });

    Object.entries(allScores).forEach(([date, scores]) => {
      const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      chartData.push({ date, average, formatted: formatDateReadable(date) });
    });
  }

  chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const statistics = calculateStatistics(chartData);
  const statusInfo = getStatusColor(statistics.current);

  const handleDownloadPDF = async () => {
    try {
      if (!cardRef.current) {
        throw new Error('Compliance trend card is not ready for export.');
      }
      const filename = `compliance-trend-${selectedRange}-${new Date().toISOString().split('T')[0]}.pdf`;
      await generatePDF(cardRef.current, filename, {
        period: selectedTimeRange.label,
        statistics,
        insight: statistics.insight,
        complianceDownloadLayout: true,
      });
    } catch (downloadError) {
      console.error('Error downloading PDF:', downloadError);
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'The compliance trend report could not be exported. Please try again.',
      });
    }
  };

  return (
    <div ref={cardRef}>
      <Card className={cn('col-span-2', brandColors.surfaces.dashboardCard)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Compliance Trend Report
              </CardTitle>
              <CardDescription>Performance tracking across all agencies</CardDescription>
            </div>
            <div className="flex items-center gap-2" data-export-ignore="true">
              <InfoBubble
                title={EDUCATION_CONTENT.title}
                summary={EDUCATION_CONTENT.summary}
                sections={EDUCATION_CONTENT.sections}
              />
              <Button onClick={handleDownloadPDF} variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download Report
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" data-export-ignore="true">
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
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm leading-relaxed text-slate-700">
              <span className="font-semibold">Summary:</span> {statistics.insight}
            </p>
          </div>

          <div className={`grid ${COMPLIANCE_TREND_CONFIG.CHART_COLS} gap-3`}>
            <TrendStatCard
              label="Current Score"
              value={`${statistics.current.toFixed(1)}%`}
              textColor={statusInfo.text}
              bgColor={statusInfo.bg}
              description={statusInfo.status}
            />
            <TrendStatCard
              label="Highest Score"
              value={`${statistics.highest.toFixed(1)}%`}
              textColor="text-emerald-700"
              bgColor="border border-emerald-200 bg-emerald-50"
              description="Peak performance"
            />
            <TrendStatCard
              label="Lowest Score"
              value={`${statistics.lowest.toFixed(1)}%`}
              textColor="text-orange-700"
              bgColor="border border-orange-200 bg-orange-50"
              description="Minimum recorded"
            />
            <TrendStatCard
              label="Progress"
              value={`${statistics.change > 0 ? '+' : ''}${statistics.change.toFixed(1)}%`}
              textColor={statistics.trend === 'up' ? 'text-green-700' : statistics.trend === 'down' ? 'text-red-700' : 'text-slate-700'}
              bgColor={statistics.trend === 'up' ? 'border border-green-200 bg-green-50' : statistics.trend === 'down' ? 'border border-red-200 bg-red-50' : 'border border-gray-200 bg-gray-50'}
              description={statistics.trend === 'up' ? 'Improving' : statistics.trend === 'down' ? 'Declining' : 'Stable'}
            />
          </div>

          <div className="border-t pt-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Score Legend:</span>
            </div>
            <div className={`grid ${COMPLIANCE_TREND_CONFIG.LEGEND_COLS} gap-3`}>
              {LEGEND_ITEMS.map((item) => (
                <ColorLegendItem key={item.label} color={item.color} label={item.label} />
              ))}
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Performance Trend</h3>
            {chartData.length > 0 ? (
              <ChartContainer
                config={{
                  average: {
                    label: 'Average Compliance Score',
                    color: 'var(--chart-1)',
                  },
                } satisfies ChartConfig}
                className="h-80 w-full"
              >
                <LineChart
                  data={chartData}
                  accessibilityLayer
                  margin={{
                    left: 12,
                    right: 12,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="formatted"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => (typeof value === 'string' ? value : '')}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value: number) => [
                          `${value.toFixed(1)}% - ${value >= 80 ? 'Excellent' : value >= 50 ? 'Moderate' : 'Needs Improvement'}`,
                          'Compliance Score',
                        ]}
                      />
                    }
                  />
                  <Line
                    dataKey="average"
                    type="monotone"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-1))', r: 4 }}
                    isAnimationActive
                    name="Average Compliance Score"
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <EmptyState
                title="No trend data available yet"
                description="Completed audits will appear here once enough score history exists."
                icon={<AlertCircle className="h-6 w-6" />}
                compact
                className="border-0 bg-transparent shadow-none"
              />
            )}
          </div>

          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <p className="mb-2 text-xs font-semibold text-indigo-900">Recommendation</p>
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
    </div>
  );
};
