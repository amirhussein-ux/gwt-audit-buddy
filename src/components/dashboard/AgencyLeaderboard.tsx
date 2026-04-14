import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Download, TrendingUp, Award, Info, Target } from 'lucide-react';
import { generateLeaderboardPDF } from '@/utils/leaderboardPdfExport';

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

// Utility functions
const getAgencyTier = (score: number): { tier: 'elite' | 'strong' | 'developing' | 'emerging'; label: string; color: string } => {
  if (score >= 85) return { tier: 'elite', label: 'Elite Performer', color: 'bg-green-50 text-green-700' };
  if (score >= 70) return { tier: 'strong', label: 'Strong Performer', color: 'bg-blue-50 text-blue-700' };
  if (score >= 55) return { tier: 'developing', label: 'Developing', color: 'bg-yellow-50 text-yellow-700' };
  return { tier: 'emerging', label: 'Emerging Performer', color: 'bg-orange-50 text-orange-700' };
};

const getScoreBadgeColor = (score: number) => {
  if (score >= 85) return 'bg-green-100 text-green-800';
  if (score >= 70) return 'bg-blue-100 text-blue-800';
  if (score >= 55) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
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
  const excellentCount = scores.filter(s => s >= 85).length;
  const scoreGap = topScore - lowestScore;

  let performanceInsight = '';
  if (excellentCount >= leaderboard.length * 0.7) {
    performanceInsight = `Excellent system-wide performance! ${excellentCount} of ${leaderboard.length} top agencies exceed 85%, demonstrating strong digital maturity.`;
  } else if (excellentCount >= leaderboard.length * 0.4) {
    performanceInsight = `Good performance across the system. ${excellentCount} agencies are leading the way at 85%+, with others following closely.`;
  } else if (averageScore >= 70) {
    performanceInsight = `Solid foundation established. Most agencies are performing well, but top performers show what's achievable.`;
  } else {
    performanceInsight = `Opportunity for improvement. Performance is inconsistent across agencies, indicating shared challenges.`;
  }

  let gapAnalysis = '';
  if (scoreGap < 10) {
    gapAnalysis = `${scoreGap.toFixed(1)}% gap — very consistent performance across all agencies`;
  } else if (scoreGap < 25) {
    gapAnalysis = `${scoreGap.toFixed(1)}% gap — moderate variation; knowledge sharing could help`;
  } else {
    gapAnalysis = `${scoreGap.toFixed(1)}% gap — significant opportunity; top performers have solutions to share`;
  }

  return { topScore, averageScore, lowestScore, excellentCount, performanceInsight, gapAnalysis };
};

export const AgencyLeaderboard = () => {
  const { token } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
  const [showGuide, setShowGuide] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

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
      if (!chartRef.current) return;
      const filename = `agency-leaderboard-${new Date().toISOString().split('T')[0]}.pdf`;
      await generateLeaderboardPDF(chartRef.current, filename, { leaderboard, stats });
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Top Score */}
              <div className="rounded-lg p-4 bg-green-50 border border-green-200">
                <p className="text-xs text-slate-600 font-medium mb-1">Top Score</p>
                <p className="text-2xl font-bold text-green-700">{stats.topScore.toFixed(1)}%</p>
                <p className="text-xs text-green-600 mt-1">Best performer</p>
              </div>

              {/* Average Score */}
              <div className="rounded-lg p-4 bg-blue-50 border border-blue-200">
                <p className="text-xs text-slate-600 font-medium mb-1">Average Score</p>
                <p className="text-2xl font-bold text-blue-700">{stats.averageScore.toFixed(1)}%</p>
                <p className="text-xs text-blue-600 mt-1">System average</p>
              </div>

              {/* Lowest Score */}
              <div className="rounded-lg p-4 bg-orange-50 border border-orange-200">
                <p className="text-xs text-slate-600 font-medium mb-1">Lowest Score</p>
                <p className="text-2xl font-bold text-orange-700">{stats.lowestScore.toFixed(1)}%</p>
                <p className="text-xs text-orange-600 mt-1">Opportunity area</p>
              </div>

              {/* Elite Performers */}
              <div className="rounded-lg p-4 bg-purple-50 border border-purple-200">
                <p className="text-xs text-slate-600 font-medium mb-1">Elite Performers</p>
                <p className="text-2xl font-bold text-purple-700">{stats.excellentCount}</p>
                <p className="text-xs text-purple-600 mt-1">Exceeding standard</p>
              </div>
            </div>

            {/* Performance Tier Legend */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold text-slate-700">Performance Tiers:</span>
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Info className="h-3 w-3" /> Learn more
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <span className="text-xs text-slate-600">Elite (85%+)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                  <span className="text-xs text-slate-600">Strong (70-84%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <span className="text-xs text-slate-600">Developing (55-69%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                  <span className="text-xs text-slate-600">Emerging (&lt;55%)</span>
                </div>
              </div>
            </div>

            {/* Educational Guide */}
            {showGuide && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                  <Award className="h-4 w-4" /> Understanding Agency Performance
                </h4>
                <div className="space-y-2 text-sm text-slate-700">
                  <p>
                    <strong>What is this ranking?</strong> Agencies are ranked by their overall compliance score, reflecting how well their websites meet digital standards for accessibility, functionality, and user experience.
                  </p>
                  <p>
                    <strong>Performance Tiers:</strong>
                    <ul className="list-disc list-inside mt-1 ml-2">
                      <li>Elite (85%+) = Industry-leading examples to learn from</li>
                      <li>Strong (70-84%) = Solid compliance with best practices</li>
                      <li>Developing (55-69%) = Good foundation, targeted improvements needed</li>
                      <li>Emerging (&lt;55%) = Significant work required</li>
                    </ul>
                  </p>
                  <p>
                    <strong>How to use:</strong> Learn from top performers, identify common challenges across peers, and share solutions to improve system-wide compliance.
                  </p>
                </div>
              </div>
            )}

            {/* Chart Section */}
            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold mb-4 text-slate-900">Compliance Rankings</h3>
              <div ref={chartRef} className="bg-white rounded-lg">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="acronym" tick={{ fontSize: 12 }} />
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
                      formatter={(value: number) => {
                        const tier = getAgencyTier(value);
                        return [`${value.toFixed(1)}% — ${tier.label}`, 'Score'];
                      }}
                      labelFormatter={(label) => `Agency: ${label}`}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <ReferenceLine
                      y={85}
                      stroke="#22c55e"
                      strokeDasharray="5 5"
                      label={{ value: 'Elite (85%)', position: 'left', fill: '#22c55e', fontSize: 11 }}
                    />
                    <ReferenceLine
                      y={70}
                      stroke="#2563eb"
                      strokeDasharray="5 5"
                      label={{ value: 'Strong (70%)', position: 'left', fill: '#2563eb', fontSize: 11 }}
                    />
                    <Bar dataKey="score" fill="#2563eb" name="Compliance Score" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-indigo-900 mb-2">📊 Performance Gap Analysis</p>
              <p className="text-sm text-indigo-800">{stats.gapAnalysis}</p>
              {stats.topScore - stats.lowestScore > 20 && (
                <p className="text-sm text-indigo-800 mt-2">
                  💡 <strong>Recommendation:</strong> Facilitate peer learning sessions where top performers share best practices. Knowledge transfer could significantly improve lower-ranked agencies.
                </p>
              )}
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
