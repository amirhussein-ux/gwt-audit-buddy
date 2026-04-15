import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Download, Award, Info } from 'lucide-react';
import { generateLeaderboardPDF } from '@/utils/leaderboardPdfExport';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

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

// Constants
const LEADERBOARD_CONFIG = {
  TIER_THRESHOLDS: {
    ELITE: 85,
    STRONG: 70,
    DEVELOPING: 55,
  },
  GRID_COLS: 'grid-cols-2 md:grid-cols-4',
  ICON_SIZES: {
    SMALL: 'h-4 w-4',
    MEDIUM: 'h-5 w-5',
  },
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

const EDUCATIONAL_GUIDE = {
  title: 'Understanding Agency Performance',
  sections: [
    {
      heading: 'What is this ranking?',
      content: 'Agencies are ranked by their overall compliance score, reflecting how well their websites meet digital standards for accessibility, functionality, and user experience.',
    },
    {
      heading: 'Performance Tiers:',
      list: [
        'Elite (85%+) = Industry-leading examples to learn from',
        'Strong (70-84%) = Solid compliance with best practices',
        'Developing (55-69%) = Good foundation, targeted improvements needed',
        'Emerging (<55%) = Significant work required',
      ],
    },
    {
      heading: 'How to use:',
      content: 'Learn from top performers, identify common challenges across peers, and share solutions to improve system-wide compliance.',
    },
  ],
};

// Utility functions
const getTierFromScore = (score: number): 'elite' | 'strong' | 'developing' | 'emerging' => {
  if (score >= LEADERBOARD_CONFIG.TIER_THRESHOLDS.ELITE) return 'elite';
  if (score >= LEADERBOARD_CONFIG.TIER_THRESHOLDS.STRONG) return 'strong';
  if (score >= LEADERBOARD_CONFIG.TIER_THRESHOLDS.DEVELOPING) return 'developing';
  return 'emerging';
};

const getAgencyTier = (score: number): { tier: 'elite' | 'strong' | 'developing' | 'emerging'; label: string; color: string } => {
  const tier = getTierFromScore(score);
  return { tier, ...TIER_LABELS[tier] };
};

const getScoreBadgeColor = (score: number) => {
  const tier = getTierFromScore(score);
  return BADGE_COLORS[tier];
};

const getMedalIcon = (rank: number) => {
  const iconClass = LEADERBOARD_CONFIG.ICON_SIZES.SMALL;
  if (rank === 1) return <Trophy className={`${iconClass} text-yellow-500`} />;
  if (rank === 2) return <Medal className={`${iconClass} text-gray-400`} />;
  if (rank === 3) return <Medal className={`${iconClass} text-orange-600`} />;
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

  const scores = leaderboard.map(e => e.overallScore);
  const topScore = Math.max(...scores);
  const lowestScore = Math.min(...scores);
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const excellentCount = scores.filter(s => s >= LEADERBOARD_CONFIG.TIER_THRESHOLDS.ELITE).length;
  const scoreGap = topScore - lowestScore;

  let performanceInsight = '';
  if (excellentCount >= leaderboard.length * LEADERBOARD_CONFIG.ELITE_PERCENTAGE_THRESHOLD) {
    performanceInsight = `Excellent system-wide performance! ${excellentCount} of ${leaderboard.length} top agencies exceed ${LEADERBOARD_CONFIG.TIER_THRESHOLDS.ELITE}%, demonstrating strong digital maturity.`;
  } else if (excellentCount >= leaderboard.length * LEADERBOARD_CONFIG.GOOD_PERFORMANCE_THRESHOLD) {
    performanceInsight = `Good performance across the system. ${excellentCount} agencies are leading the way at ${LEADERBOARD_CONFIG.TIER_THRESHOLDS.ELITE}%+, with others following closely.`;
  } else if (averageScore >= LEADERBOARD_CONFIG.AVERAGE_SCORE_THRESHOLD) {
    performanceInsight = `Solid foundation established. Most agencies are performing well, but top performers show what's achievable.`;
  } else {
    performanceInsight = `Opportunity for improvement. Performance is inconsistent across agencies, indicating shared challenges.`;
  }

  let gapAnalysis = '';
  if (scoreGap < LEADERBOARD_CONFIG.SMALL_GAP_THRESHOLD) {
    gapAnalysis = `${scoreGap.toFixed(1)}% gap — very consistent performance across all agencies`;
  } else if (scoreGap < LEADERBOARD_CONFIG.MEDIUM_GAP_THRESHOLD) {
    gapAnalysis = `${scoreGap.toFixed(1)}% gap — moderate variation; knowledge sharing could help`;
  } else {
    gapAnalysis = `${scoreGap.toFixed(1)}% gap — significant opportunity; top performers have solutions to share`;
  }

  return { topScore, averageScore, lowestScore, excellentCount, performanceInsight, gapAnalysis };
};

// Helper Components
interface StatsMetricCardProps {
  metric: typeof METRIC_CARDS[0];
  stats: LeaderboardStats;
}

const StatsMetricCard = ({ metric, stats }: StatsMetricCardProps) => {
  const value = stats[metric.key as keyof LeaderboardStats] as number;
  const displayValue = typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value;
  
  return (
    <div className={`rounded-lg p-4 ${metric.bgColor} border ${metric.borderColor}`}>
      <p className="text-xs text-slate-600 font-medium mb-1">{metric.label}</p>
      <p className={`text-2xl font-bold ${metric.textColor}`}>
        {displayValue}{metric.suffix}
      </p>
      <p className={`text-xs ${metric.subColor} mt-1`}>{metric.description}</p>
    </div>
  );
};

interface TierLegendProps {
  onLearnMore: () => void;
  showGuide: boolean;
}

const TierLegend = ({ onLearnMore, showGuide }: TierLegendProps) => (
  <div className="border-t pt-4">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-semibold text-slate-700">Performance Tiers:</span>
      <button
        onClick={onLearnMore}
        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
      >
        <Info className={LEADERBOARD_CONFIG.ICON_SIZES.SMALL} /> Learn more
      </button>
    </div>
    <div className={`grid ${LEADERBOARD_CONFIG.GRID_COLS} gap-2`}>
      {TIER_LEGEND.map((tier) => (
        <div key={tier.label} className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${tier.color}`}></div>
          <span className="text-xs text-slate-600">{tier.label}</span>
        </div>
      ))}
    </div>
  </div>
);

interface EducationalGuideProps {
  isVisible: boolean;
}

const EducationalGuide = ({ isVisible }: EducationalGuideProps) => {
  if (!isVisible) return null;
  
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
      <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
        <Award className={LEADERBOARD_CONFIG.ICON_SIZES.SMALL} /> {EDUCATIONAL_GUIDE.title}
      </h4>
      <div className="space-y-2 text-sm text-slate-700">
        {EDUCATIONAL_GUIDE.sections.map((section, idx) => (
          <p key={idx}>
            <strong>{section.heading}</strong>
            {section.content && ` ${section.content}`}
            {section.list && (
              <ul className="list-disc list-inside mt-1 ml-2">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </p>
        ))}
      </div>
    </div>
  );
};

interface PerformanceGapAnalysisProps {
  stats: LeaderboardStats;
}

const PerformanceGapAnalysis = ({ stats }: PerformanceGapAnalysisProps) => {
  const showRecommendation = stats.topScore - stats.lowestScore > LEADERBOARD_CONFIG.PERFORMANCE_GAP_THRESHOLD;
  
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-indigo-900 mb-2">📊 Performance Gap Analysis</p>
      <p className="text-sm text-indigo-800">{stats.gapAnalysis}</p>
      {showRecommendation && (
        <p className="text-sm text-indigo-800 mt-2">
          💡 <strong>Recommendation:</strong> Facilitate peer learning sessions where top performers share best practices. Knowledge transfer could significantly improve lower-ranked agencies.
        </p>
      )}
    </div>
  );
};

export const AgencyLeaderboard = () => {
  const { token } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
  const [showGuide, setShowGuide] = useState(false);

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top Agencies
          </CardTitle>
          <CardDescription>Performance rankings and insights</CardDescription>
        </CardHeader>
        <CardContent className="h-96 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  const leaderboard = data?.leaderboard || [];
  const stats = calculateLeaderboardStats(leaderboard);

  const chartData: ChartEntry[] = leaderboard.map((entry) => {
    const tier = getAgencyTier(entry.overallScore).tier;
    return {
      name: entry.agency.name,
      acronym: entry.agency.acronym || entry.agency.name.split(' ')[0],
      score: entry.overallScore,
      rank: entry.rank,
      tier,
    };
  });

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Medal className="h-4 w-4 text-orange-600" />;
    return null;
  };

  const handleDownloadPDF = async () => {
    try {
      const filename = `agency-leaderboard-${new Date().toISOString().split('T')[0]}.pdf`;
      await generateLeaderboardPDF(document.body, filename, { leaderboard, stats });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top Agencies
            </CardTitle>
            <CardDescription>Performance rankings and insights</CardDescription>
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
      </CardHeader>

      <CardContent className="space-y-6">
        {leaderboard.length > 0 ? (
          <>
            {/* Performance Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                <span className="font-semibold">🏆 Summary:</span> {stats.performanceInsight}
              </p>
            </div>

            {/* Key Metrics Cards */}
            <div className={`grid ${LEADERBOARD_CONFIG.GRID_COLS} gap-3`}>
              {METRIC_CARDS.map((metric) => (
                <StatsMetricCard key={metric.key} metric={metric} stats={stats} />
              ))}
            </div>

            {/* Performance Tier Legend */}
            <TierLegend onLearnMore={() => setShowGuide(!showGuide)} showGuide={showGuide} />

            {/* Educational Guide */}
            <EducationalGuide isVisible={showGuide} />

            {/* Chart Section */}
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold mb-4 text-slate-900">Compliance Rankings</h3>
              <ChartContainer 
                config={{ 
                  score: { 
                    label: 'Compliance Score', 
                    color: 'var(--chart-1)' 
                  } 
                } satisfies ChartConfig}
                className="w-full h-80"
              >
                <BarChart data={chartData} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis 
                    dataKey="acronym" 
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent hideLabel />}
                    formatter={(value: number) => {
                      const tier = getAgencyTier(value);
                      return [`${value.toFixed(1)}% — ${tier.label}`, 'Score'];
                    }}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar 
                    dataKey="score" 
                    fill="var(--color-score)" 
                    name="Compliance Score"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </div>

            {/* Detailed Rankings List */}
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold mb-4 text-slate-900">Detailed Rankings</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {leaderboard.slice(0, 10).map((entry) => {
                  const tier = getAgencyTier(entry.overallScore);
                  return (
                    <div
                      key={entry.agency._id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center justify-center w-6">
                          {getMedalIcon(entry.rank) || (
                            <span className="font-semibold text-slate-600">{entry.rank}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-slate-900">{entry.agency.name}</p>
                          <p className="text-xs text-slate-500">{entry.agency.acronym}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getScoreBadgeColor(entry.overallScore)}>
                          {entry.overallScore.toFixed(1)}%
                        </Badge>
                        <p className={`text-xs mt-1 font-medium ${tier.color}`}>{tier.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Performance Gap Analysis */}
            <PerformanceGapAnalysis stats={stats} />
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
