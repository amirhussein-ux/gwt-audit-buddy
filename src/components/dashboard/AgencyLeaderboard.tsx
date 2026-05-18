import { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, CartesianGrid } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateLeaderboardPDF } from '@/utils/leaderboardPdfExport';
import { InfoBubble } from '@/components/InfoBubble';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { brandColors } from '@/lib/brandColors';
import { ChartSkeleton, EmptyState, ErrorState } from '@/components/states';

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

interface LeaderboardStats {
  topScore: number;
  averageScore: number;
  lowestScore: number;
  excellentCount: number;
  performanceInsight: string;
  gapAnalysis: string;
}

interface ChartEntry {
  name: string;
  acronym: string;
  score: number;
  rank: number;
  tier: 'elite' | 'strong' | 'developing' | 'emerging';
}

const LEADERBOARD_CONFIG = {
  TIER_THRESHOLDS: {
    ELITE: 85,
    STRONG: 70,
    DEVELOPING: 55,
  },
  GRID_COLS: 'grid-cols-2 md:grid-cols-4',
  PERFORMANCE_GAP_THRESHOLD: 20,
  ELITE_PERCENTAGE_THRESHOLD: 0.7,
  GOOD_PERFORMANCE_THRESHOLD: 0.4,
  AVERAGE_SCORE_THRESHOLD: 70,
  SMALL_GAP_THRESHOLD: 10,
  MEDIUM_GAP_THRESHOLD: 25,
};

const TIER_LABELS = {
  elite: { label: 'Elite Performer', color: 'bg-green-50 text-green-700' },
  strong: { label: 'Strong Performer', color: 'bg-blue-50 text-blue-700' },
  developing: { label: 'Developing', color: 'bg-yellow-50 text-yellow-700' },
  emerging: { label: 'Emerging Performer', color: 'bg-orange-50 text-orange-700' },
};

const BADGE_COLORS = {
  elite: 'bg-green-100 text-green-800',
  strong: 'bg-blue-100 text-blue-800',
  developing: 'bg-yellow-100 text-yellow-800',
  emerging: 'bg-red-100 text-red-800',
};

const METRIC_CARDS = [
  {
    key: 'topScore',
    label: 'Top Score',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    subColor: 'text-green-600',
    suffix: '%',
    description: 'Best performer',
  },
  {
    key: 'averageScore',
    label: 'Average Score',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    subColor: 'text-blue-600',
    suffix: '%',
    description: 'System average',
  },
  {
    key: 'lowestScore',
    label: 'Lowest Score',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    subColor: 'text-orange-600',
    suffix: '%',
    description: 'Opportunity area',
  },
  {
    key: 'excellentCount',
    label: 'Elite Performers',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    subColor: 'text-purple-600',
    suffix: '',
    description: 'Exceeding standard',
  },
];

const TIER_LEGEND = [
  { color: 'bg-green-400', label: 'Elite (85%+)' },
  { color: 'bg-blue-400', label: 'Strong (70-84%)' },
  { color: 'bg-yellow-400', label: 'Developing (55-69%)' },
  { color: 'bg-orange-400', label: 'Emerging (<55%)' },
];

const GUIDE_CONTENT = {
  title: 'Understanding Agency Rankings',
  summary: 'This report compares agencies by overall compliance score so teams can spot strong practices, recurring gaps, and coaching opportunities.',
  sections: [
    {
      title: 'How to read the tiers',
      body: 'Elite agencies are strong models to learn from. Lower tiers show where more support or remediation is needed.',
    },
    {
      title: 'How to use the ranking',
      body: 'Use it to identify peer examples, spread proven fixes, and focus help where the performance gap is widest.',
    },
  ],
};

const getTierFromScore = (score: number): 'elite' | 'strong' | 'developing' | 'emerging' => {
  if (score >= LEADERBOARD_CONFIG.TIER_THRESHOLDS.ELITE) return 'elite';
  if (score >= LEADERBOARD_CONFIG.TIER_THRESHOLDS.STRONG) return 'strong';
  if (score >= LEADERBOARD_CONFIG.TIER_THRESHOLDS.DEVELOPING) return 'developing';
  return 'emerging';
};

const getAgencyTier = (score: number) => {
  const tier = getTierFromScore(score);
  return { tier, ...TIER_LABELS[tier] };
};

const getScoreBadgeColor = (score: number) => BADGE_COLORS[getTierFromScore(score)];

const getMedalIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-orange-600" />;
  return null;
};

const calculateLeaderboardStats = (leaderboard: LeaderboardEntry[]): LeaderboardStats => {
  if (leaderboard.length === 0) {
    return {
      topScore: 0,
      averageScore: 0,
      lowestScore: 0,
      excellentCount: 0,
      performanceInsight: '',
      gapAnalysis: '',
    };
  }

  const scores = leaderboard.map((entry) => entry.overallScore);
  const topScore = Math.max(...scores);
  const lowestScore = Math.min(...scores);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const excellentCount = scores.filter((score) => score >= LEADERBOARD_CONFIG.TIER_THRESHOLDS.ELITE).length;
  const scoreGap = topScore - lowestScore;

  let performanceInsight = '';
  if (excellentCount >= leaderboard.length * LEADERBOARD_CONFIG.ELITE_PERCENTAGE_THRESHOLD) {
    performanceInsight = `Excellent system-wide performance. ${excellentCount} of ${leaderboard.length} top agencies exceed ${LEADERBOARD_CONFIG.TIER_THRESHOLDS.ELITE}%.`;
  } else if (excellentCount >= leaderboard.length * LEADERBOARD_CONFIG.GOOD_PERFORMANCE_THRESHOLD) {
    performanceInsight = `Good performance across the system. ${excellentCount} agencies are leading the way at ${LEADERBOARD_CONFIG.TIER_THRESHOLDS.ELITE}%+.`;
  } else if (averageScore >= LEADERBOARD_CONFIG.AVERAGE_SCORE_THRESHOLD) {
    performanceInsight = 'A solid foundation is in place, but top performers still show room for others to improve.';
  } else {
    performanceInsight = 'Performance is inconsistent across agencies, which suggests shared barriers and coaching opportunities.';
  }

  let gapAnalysis = '';
  if (scoreGap < LEADERBOARD_CONFIG.SMALL_GAP_THRESHOLD) {
    gapAnalysis = `${scoreGap.toFixed(1)}% gap: performance is very consistent across agencies.`;
  } else if (scoreGap < LEADERBOARD_CONFIG.MEDIUM_GAP_THRESHOLD) {
    gapAnalysis = `${scoreGap.toFixed(1)}% gap: moderate variation, with clear room for knowledge sharing.`;
  } else {
    gapAnalysis = `${scoreGap.toFixed(1)}% gap: strong agencies likely have practices that can be transferred to lower-ranked teams.`;
  }

  return { topScore, averageScore, lowestScore, excellentCount, performanceInsight, gapAnalysis };
};

const StatsMetricCard = ({ metric, stats }: { metric: typeof METRIC_CARDS[number]; stats: LeaderboardStats }) => {
  const value = stats[metric.key as keyof LeaderboardStats] as number;
  const displayValue = typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value;

  return (
    <div className={`rounded-lg border p-4 ${metric.bgColor} ${metric.borderColor}`}>
      <p className="mb-1 text-xs font-medium text-slate-600">{metric.label}</p>
      <p className={`text-2xl font-bold ${metric.textColor}`}>
        {displayValue}{metric.suffix}
      </p>
      <p className={`mt-1 text-xs ${metric.subColor}`}>{metric.description}</p>
    </div>
  );
};

const PerformanceGapAnalysis = ({ stats }: { stats: LeaderboardStats }) => {
  const showRecommendation = stats.topScore - stats.lowestScore > LEADERBOARD_CONFIG.PERFORMANCE_GAP_THRESHOLD;

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
      <p className="mb-2 text-xs font-semibold text-indigo-900">Performance Gap Analysis</p>
      <p className="text-sm text-indigo-800">{stats.gapAnalysis}</p>
      {showRecommendation ? (
        <p className="mt-2 text-sm text-indigo-800">
          Recommendation: facilitate peer learning sessions so top performers can share repeatable fixes and workflows.
        </p>
      ) : null}
    </div>
  );
};

const sanitizeLeaderboard = (value: unknown): LeaderboardEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is LeaderboardEntry => {
      return (
        typeof entry === 'object' &&
        entry !== null &&
        'agency' in entry &&
        typeof entry.agency === 'object' &&
        entry.agency !== null &&
        typeof entry.overallScore === 'number'
      );
    })
    .map((entry, index) => ({
      rank: Number.isFinite(entry.rank) ? entry.rank : index + 1,
      overallScore: Number.isFinite(entry.overallScore) ? entry.overallScore : 0,
      agency: {
        _id: entry.agency?._id || `agency-${index}`,
        name: entry.agency?.name || 'Unknown agency',
        acronym: entry.agency?.acronym || '',
      },
    }));
};

export const AgencyLeaderboard = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
  const cardRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/dashboard/leaderboard?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return response.json().catch(() => ({ leaderboard: [], count: 0 })) as Promise<LeaderboardData>;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return <ChartSkeleton title="Top Agencies" description="Performance rankings and insights" showLegend={false} />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Leaderboard is unavailable"
        description={error instanceof Error ? error.message : 'The agency leaderboard could not be loaded right now.'}
        onRetry={() => void refetch()}
        retryLabel={isFetching ? 'Retrying...' : 'Retry'}
        isRetrying={isFetching}
      />
    );
  }

  const leaderboard = sanitizeLeaderboard(data?.leaderboard);
  const stats = calculateLeaderboardStats(leaderboard);
  const chartData: ChartEntry[] = leaderboard.map((entry) => ({
    name: entry.agency.name,
    acronym: entry.agency.acronym || entry.agency.name.split(' ')[0],
    score: entry.overallScore,
    rank: entry.rank,
    tier: getAgencyTier(entry.overallScore).tier,
  }));

  const handleDownloadPDF = async () => {
    try {
      if (!cardRef.current) {
        throw new Error('Agency leaderboard card is not ready for export.');
      }
      const filename = `agency-leaderboard-${new Date().toISOString().split('T')[0]}.pdf`;
      await generateLeaderboardPDF(cardRef.current, filename, { leaderboard, stats });
    } catch (downloadError) {
      console.error('Error downloading PDF:', downloadError);
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'The agency leaderboard could not be exported. Please try again.',
      });
    }
  };

  return (
    <div ref={cardRef}>
      <Card className={brandColors.surfaces.dashboardCard}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top Agencies
              </CardTitle>
              <CardDescription>Performance rankings and insights</CardDescription>
            </div>
            <div className="flex items-center gap-2" data-export-ignore="true">
              <InfoBubble
                title={GUIDE_CONTENT.title}
                summary={GUIDE_CONTENT.summary}
                sections={GUIDE_CONTENT.sections}
              />
              <Button onClick={handleDownloadPDF} variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download Report
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {leaderboard.length > 0 ? (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm leading-relaxed text-slate-700">
                  <span className="font-semibold">Summary:</span> {stats.performanceInsight}
                </p>
              </div>

              <div className={`grid ${LEADERBOARD_CONFIG.GRID_COLS} gap-3`}>
                {METRIC_CARDS.map((metric) => (
                  <StatsMetricCard key={metric.key} metric={metric} stats={stats} />
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">Performance Tiers:</span>
                </div>
                <div className={`grid ${LEADERBOARD_CONFIG.GRID_COLS} gap-2`}>
                  {TIER_LEGEND.map((tier) => (
                    <div key={tier.label} className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${tier.color}`} />
                      <span className="text-xs text-slate-600">{tier.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">Compliance Rankings</h3>
                <ChartContainer
                  config={{
                    score: {
                      label: 'Compliance Score',
                      color: 'var(--chart-1)',
                    },
                  } satisfies ChartConfig}
                  className="h-80 w-full"
                >
                  <BarChart data={chartData} accessibilityLayer>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="acronym" tickLine={false} tickMargin={10} axisLine={false} />
                    <ChartTooltip
                      content={<ChartTooltipContent hideLabel />}
                      formatter={(value: number) => {
                        const tier = getAgencyTier(value);
                        return [`${value.toFixed(1)}% - ${tier.label}`, 'Score'];
                      }}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="score" fill="var(--color-score)" name="Compliance Score" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>

              <div className="border-t pt-6">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">Detailed Rankings</h3>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {leaderboard.slice(0, 10).map((entry) => {
                    const tier = getAgencyTier(entry.overallScore);
                    return (
                      <div
                        key={entry.agency._id}
                        className="flex items-center justify-between rounded-lg bg-slate-50 p-3 transition hover:bg-slate-100"
                      >
                        <div className="flex flex-1 items-center gap-3">
                          <div className="flex w-6 items-center justify-center">
                            {getMedalIcon(entry.rank) || (
                              <span className="font-semibold text-slate-600">{entry.rank}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">{entry.agency.name}</p>
                            <p className="text-xs text-slate-500">{entry.agency.acronym}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={getScoreBadgeColor(entry.overallScore)}>
                            {entry.overallScore.toFixed(1)}%
                          </Badge>
                          <p className={`mt-1 text-xs font-medium ${tier.color}`}>{tier.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <PerformanceGapAnalysis stats={stats} />
            </>
          ) : (
            <EmptyState
              title="No leaderboard data available"
              description="Complete more audits to compare agencies here."
              compact
              className="border-0 bg-transparent shadow-none"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
