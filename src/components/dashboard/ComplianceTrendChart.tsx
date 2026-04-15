import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, CartesianGrid } from 'recharts';
import { Download, TrendingUp, Award, AlertCircle, Info } from 'lucide-react';
import { generatePDF } from '@/utils/pdfExport';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

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

// Constants
const COMPLIANCE_TREND_CONFIG = {
  ICON_SIZES: {
    SMALL: 'h-4 w-4',
    MEDIUM: 'h-5 w-5',
  },
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
  title: 'Understanding Compliance',
  sections: [
    {
      heading: 'What is Compliance?',
      content: 'A measure of how well government websites meet digital standards for accessibility, functionality, and user experience.',
    },
    {
      heading: 'How is it scored?',
      content: 'Compliance scores are calculated based on WCAG accessibility standards, mobile responsiveness, required government elements (PST, Transparency Seal, links), and content quality.',
    },
  ],
};

// Utility functions
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
    return `Strong improvement! Compliance has increased by ${change.toFixed(1)}% over this period.`;
  } else if (trend === 'up') {
    return `Steady progress. Compliance has improved by ${change.toFixed(1)}% over this period.`;
  } else if (trend === 'down' && Math.abs(change) > COMPLIANCE_TREND_CONFIG.TREND_THRESHOLD_SIGNIFICANT) {
    return `Attention needed. Compliance has decreased by ${Math.abs(change).toFixed(1)}% over this period.`;
  } else if (trend === 'down') {
    return `Minor decline. Compliance has decreased by ${Math.abs(change).toFixed(1)}% over this period.`;
  } else {
    return `Stable performance. Compliance scores have remained consistent over this period.`;
  }
};

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
  const trend = change > COMPLIANCE_TREND_CONFIG.TREND_THRESHOLD_MINOR ? 'up' : change < -COMPLIANCE_TREND_CONFIG.TREND_THRESHOLD_MINOR ? 'down' : 'stable';

  const insight = getTrendInsight(change, trend);

  return { current, highest, lowest, average, change, trend, insight };
};

// Helper Components
interface TrendStatCardProps {
  label: string;
  value: string;
  textColor: string;
  bgColor: string;
  description: string;
}

const TrendStatCard = ({ label, value, textColor, bgColor, description }: TrendStatCardProps) => (
  <div className={`rounded-lg p-4 ${bgColor}`}>
    <p className="text-xs text-slate-600 font-medium mb-1">{label}</p>
    <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
    <p className={`text-xs ${textColor} mt-1`}>{description}</p>
  </div>
);

interface ColorLegendItemProps {
  color: string;
  label: string;
}

const ColorLegendItem = ({ color, label }: ColorLegendItemProps) => (
  <div className="flex items-center gap-2">
    <div className={`w-4 h-4 rounded ${color}`}></div>
    <span className="text-xs text-slate-600">{label}</span>
  </div>
);

interface EducationGuideProps {
  isVisible: boolean;
}

const EducationGuide = ({ isVisible }: EducationGuideProps) => {
  if (!isVisible) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
      <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
        <Award className={COMPLIANCE_TREND_CONFIG.ICON_SIZES.SMALL} /> {EDUCATION_CONTENT.title}
      </h4>
      <div className="space-y-2 text-sm text-slate-700">
        {EDUCATION_CONTENT.sections.map((section, idx) => (
          <p key={idx}>
            <strong>{section.heading}</strong> {section.content}
          </p>
        ))}
      </div>
    </div>
  );
};

export const ComplianceTrendChart = () => {
  const { token } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
  const [selectedRange, setSelectedRange] = useState<string>('quarterly');
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
      const filename = `compliance-trend-${selectedRange}-${new Date().toISOString().split('T')[0]}.pdf`;
      await generatePDF(document.body, filename, {
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
            bgColor="bg-emerald-50 border border-emerald-200"
            description="Peak performance"
          />
          <TrendStatCard
            label="Lowest Score"
            value={`${statistics.lowest.toFixed(1)}%`}
            textColor="text-orange-700"
            bgColor="bg-orange-50 border border-orange-200"
            description="Minimum recorded"
          />
          <TrendStatCard
            label="Progress"
            value={`${statistics.change > 0 ? '+' : ''}${statistics.change.toFixed(1)}%`}
            textColor={statistics.trend === 'up' ? 'text-green-700' : statistics.trend === 'down' ? 'text-red-700' : 'text-slate-700'}
            bgColor={statistics.trend === 'up' ? 'bg-green-50 border border-green-200' : statistics.trend === 'down' ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}
            description={statistics.trend === 'up' ? '📈 Improving' : statistics.trend === 'down' ? '📉 Declining' : '➡️ Stable'}
          />
        </div>

        {/* Color Legend */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-slate-700">Score Legend:</span>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Info className={COMPLIANCE_TREND_CONFIG.ICON_SIZES.SMALL} /> Learn more
            </button>
          </div>
          <div className={`grid ${COMPLIANCE_TREND_CONFIG.LEGEND_COLS} gap-3`}>
            {LEGEND_ITEMS.map((item) => (
              <ColorLegendItem key={item.label} color={item.color} label={item.label} />
            ))}
          </div>
        </div>

        {/* Educational Guide (Expandable) */}
        <EducationGuide isVisible={showGuide} />

        {/* Chart Section */}
        <div className="border-t pt-6">
          <h3 className="text-sm font-semibold mb-4 text-slate-900">Performance Trend</h3>
          {chartData.length > 0 ? (
            <ChartContainer 
              config={{ 
                average: { 
                  label: 'Average Compliance Score', 
                  color: 'var(--chart-1)' 
                } 
              } satisfies ChartConfig}
              className="w-full h-80"
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
                  tickFormatter={(value) => {
                    try {
                      const date = new Date(value);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    } catch {
                      return value.slice(0, 10);
                    }
                  }}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent 
                    hideLabel 
                    formatter={(value: number) => [
                      `${value.toFixed(1)}% - ${
                        value >= 80 ? 'Excellent' : value >= 50 ? 'Moderate' : 'Needs Improvement'
                      }`,
                      'Compliance Score',
                    ]}
                  />}
                />
                <Line
                  dataKey="average"
                  type="monotone"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--chart-1))', r: 4 }}
                  isAnimationActive={true}
                  name="Average Compliance Score"
                />
              </LineChart>  
            </ChartContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-500">
              <AlertCircle className="h-5 w-5 mr-2" />
              No trend data available yet
            </div>
          )}
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
