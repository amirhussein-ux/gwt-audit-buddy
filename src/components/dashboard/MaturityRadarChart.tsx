import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Info, TrendingUp, TrendingDown, Minus, Globe, MonitorSmartphone, FileText, AlertCircle } from 'lucide-react';
import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MaturityData {
  agencies: Array<{
    _id: string;
    name: string;
    latestScore?: {
      webPresence?: { averageScore: number };
      webUsability?: { accessibility: number; total?: number };
      overallScore: number;
    };
  }>;
}

// ─── Plain-language explanations for non-technical users ─────────────────────
const METRIC_META = {
  webPresence: {
    label: 'Web Presence',
    icon: Globe,
    color: 'blue',
    colorClass: {
      text: 'text-blue-600',
      bg: 'bg-blue-600',
      light: 'bg-blue-50',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-700',
    },
    what: 'Is the website actually online and findable?',
    why: 'Measures whether the government site has the basic required elements — like the Philippine Standard Time display, Transparency Seal, logo, and GovPH links — that citizens expect to find.',
    goodSign: 'Citizens can easily confirm they are on an official government website.',
    badSign: 'The site may be missing required government seals or is hard to find.',
  },
  webUsability: {
    label: 'Web Usability',
    icon: MonitorSmartphone,
    color: 'green',
    colorClass: {
      text: 'text-emerald-600',
      bg: 'bg-emerald-600',
      light: 'bg-emerald-50',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-700',
    },
    what: 'Is the website easy to use for everyone?',
    why: 'Checks if the site is accessible to people with disabilities — proper image descriptions, readable text contrast, working forms, and fast load times. Based on international WCAG standards.',
    goodSign: 'People with visual or motor impairments can use the site without difficulty.',
    badSign: 'Some citizens — especially those with disabilities — may struggle to access information.',
  },
  contentQuality: {
    label: 'Content Quality',
    icon: FileText,
    color: 'purple',
    colorClass: {
      text: 'text-violet-600',
      bg: 'bg-violet-600',
      light: 'bg-violet-50',
      border: 'border-violet-200',
      badge: 'bg-violet-100 text-violet-700',
    },
    what: 'Is the information on the site clear and complete?',
    why: 'Evaluates whether the site has a clear tagline, uncluttered layout, Contact Us and About Us sections easy to find, and content that matches what Filipinos need from a government website.',
    goodSign: 'Citizens immediately understand what the agency does and how to reach them.',
    badSign: 'The site may be cluttered, confusing, or missing key information about the agency.',
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMaturityLabel(score: number): {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  if (score >= 90) return {
    label: 'Excellent',
    description: 'Meets or exceeds all GWT standards',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
  };
  if (score >= 75) return {
    label: 'Good',
    description: 'Mostly compliant with minor gaps',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
  };
  if (score >= 50) return {
    label: 'Developing',
    description: 'Partially meets standards — improvement needed',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
  };
  return {
    label: 'Needs Attention',
    description: 'Significant gaps in GWT compliance',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
  };
}

function getTrendIcon(score: number) {
  if (score >= 75) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (score >= 50) return <Minus className="h-3.5 w-3.5 text-amber-500" />;
  return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
}

// ─── Tooltip component ────────────────────────────────────────────────────────
function MetricTooltip({
  meta,
  score,
  agencyCount,
}: {
  meta: typeof METRIC_META[keyof typeof METRIC_META];
  score: number;
  agencyCount: number;
}) {
  const maturity = getMaturityLabel(score);
  return (
    <div className={`rounded-xl border p-4 space-y-3 text-sm shadow-lg ${maturity.bgColor} ${maturity.borderColor}`}>
      {/* What is this? */}
      <div>
        <p className="font-semibold text-slate-800 mb-1">📌 What is this?</p>
        <p className="text-slate-600 leading-relaxed">{meta.what}</p>
      </div>
      {/* Why does it matter? */}
      <div>
        <p className="font-semibold text-slate-800 mb-1">💡 Why it matters</p>
        <p className="text-slate-600 leading-relaxed">{meta.why}</p>
      </div>
      {/* Good/bad signs */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
          <p className="text-xs font-semibold text-emerald-700 mb-1">✅ High score means</p>
          <p className="text-xs text-emerald-700 leading-relaxed">{meta.goodSign}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-2">
          <p className="text-xs font-semibold text-red-700 mb-1">⚠️ Low score means</p>
          <p className="text-xs text-red-700 leading-relaxed">{meta.badSign}</p>
        </div>
      </div>
      <p className="text-xs text-slate-400 border-t pt-2">
        Average across {agencyCount} audited {agencyCount === 1 ? 'agency' : 'agencies'}
      </p>
    </div>
  );
}

// ─── Score Bar component ──────────────────────────────────────────────────────
function ScoreBar({
  metaKey,
  score,
  agencyCount,
}: {
  metaKey: keyof typeof METRIC_META;
  score: number;
  agencyCount: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const meta = METRIC_META[metaKey];
  const maturity = getMaturityLabel(score);
  const Icon = meta.icon;
  const clampedScore = Math.min(100, Math.max(0, score));

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-md ${meta.colorClass.light}`}>
            <Icon className={`h-4 w-4 ${meta.colorClass.text}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-800 truncate">{meta.label}</span>
              <button
                onClick={() => setShowTooltip((v) => !v)}
                className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                aria-label={`What is ${meta.label}?`}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 truncate">{meta.what}</p>
          </div>
        </div>

        {/* Score + badge */}
        <div className="flex items-center gap-2 shrink-0">
          {getTrendIcon(score)}
          <div className="text-right">
            <span className={`text-lg font-bold ${meta.colorClass.text}`}>
              {clampedScore.toFixed(1)}%
            </span>
            <div className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${maturity.bgColor} ${maturity.color} border ${maturity.borderColor} mt-0.5 text-center`}>
              {maturity.label}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-700 ease-out ${meta.colorClass.bg}`}
            style={{ width: `${clampedScore}%` }}
          />
        </div>
        {/* Threshold markers */}
        <div className="absolute top-0 left-[50%] h-2.5 w-px bg-slate-300 opacity-60" title="50% threshold" />
        <div className="absolute top-0 left-[75%] h-2.5 w-px bg-slate-300 opacity-60" title="75% threshold" />
        <div className="absolute top-0 left-[90%] h-2.5 w-px bg-slate-300 opacity-60" title="90% threshold" />
      </div>

      {/* Threshold labels */}
      <div className="flex justify-between text-[10px] text-slate-400 px-0.5">
        <span>Needs Attention</span>
        <span className="ml-auto mr-[25%]">Developing</span>
        <span className="mr-[10%]">Good</span>
        <span>Excellent</span>
      </div>

      {/* Expandable tooltip */}
      {showTooltip && (
        <div className="mt-1">
          <MetricTooltip meta={meta} score={clampedScore} agencyCount={agencyCount} />
        </div>
      )}
    </div>
  );
}

// ─── Overall maturity badge ───────────────────────────────────────────────────
function OverallBadge({ score, agencyCount }: { score: number; agencyCount: number }) {
  const maturity = getMaturityLabel(score);
  return (
    <div className={`rounded-xl border-2 p-4 ${maturity.bgColor} ${maturity.borderColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Overall Compliance
          </p>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${maturity.color}`}>{score.toFixed(1)}%</span>
            <span className={`text-sm font-semibold ${maturity.color}`}>{maturity.label}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{maturity.description}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-700">{agencyCount}</p>
          <p className="text-xs text-slate-500">{agencyCount === 1 ? 'Agency' : 'Agencies'} audited</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const MaturityRadarChart = () => {
  const { token } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['maturity-index'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/dashboard/maturity-index`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch maturity index');
      return response.json() as Promise<MaturityData>;
    },
    enabled: !!token,
  });

  // ── Loading state ──
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Maturity Index</CardTitle>
          <CardDescription>Government website compliance overview</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="text-sm text-slate-500">Loading audit data...</p>
        </CardContent>
      </Card>
    );
  }

  // ── Error state ──
  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Maturity Index</CardTitle>
          <CardDescription>Government website compliance overview</CardDescription>
        </CardHeader>
        <CardContent className="h-40 flex flex-col items-center justify-center gap-2 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-slate-600">Could not load maturity data.</p>
          <p className="text-xs text-slate-400">Check your connection or run an audit first.</p>
        </CardContent>
      </Card>
    );
  }

  // ── Compute averages ──
  const agencies = data.agencies ?? [];
  const auditedAgencies = agencies.filter((a) => a.latestScore);
  const count = auditedAgencies.length || 1;

  // Web Presence — averageScore field
  const avgWebPresence =
    auditedAgencies
      .filter((a) => typeof a.latestScore?.webPresence?.averageScore === 'number')
      .reduce((sum, a) => sum + (a.latestScore?.webPresence?.averageScore ?? 0), 0) /
    (auditedAgencies.filter((a) => typeof a.latestScore?.webPresence?.averageScore === 'number').length || 1);

  // Web Usability — prefer .total, fallback to .accessibility
  const avgUsability =
    auditedAgencies
      .filter((a) => typeof (a.latestScore?.webUsability?.total ?? a.latestScore?.webUsability?.accessibility) === 'number')
      .reduce((sum, a) => {
        const val = a.latestScore?.webUsability?.total ?? a.latestScore?.webUsability?.accessibility ?? 0;
        return sum + val;
      }, 0) /
    (auditedAgencies.filter((a) => a.latestScore?.webUsability).length || 1);

  // Content Quality — derived from overallScore (was incorrectly using count before)
  const avgContentQuality =
    auditedAgencies
      .filter((a) => typeof a.latestScore?.overallScore === 'number')
      .reduce((sum, a) => sum + (a.latestScore?.overallScore ?? 0), 0) /
    (auditedAgencies.filter((a) => typeof a.latestScore?.overallScore === 'number').length || 1);

  // Overall = simple average of the three dimensions
  const overallScore = (avgWebPresence + avgUsability + avgContentQuality) / 3;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-bold">Maturity Index</CardTitle>
            <CardDescription className="mt-1 text-xs leading-relaxed">
              How well do government websites meet DICT's GWT standards?{' '}
              <span className="text-slate-400">Click the</span>{' '}
              <Info className="inline h-3 w-3 text-slate-400" />{' '}
              <span className="text-slate-400">icons below to learn more about each score.</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Overall score badge */}
        <OverallBadge score={overallScore} agencyCount={auditedAgencies.length} />

        {/* Legend */}
        <div className="flex flex-wrap gap-2 text-[10px]">
          {[
            { label: 'Needs Attention', color: 'bg-red-400', range: '< 50%' },
            { label: 'Developing', color: 'bg-amber-400', range: '50–74%' },
            { label: 'Good', color: 'bg-blue-400', range: '75–89%' },
            { label: 'Excellent', color: 'bg-emerald-400', range: '90–100%' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1 text-slate-500">
              <div className={`h-2 w-2 rounded-full ${item.color}`} />
              <span>{item.label}</span>
              <span className="text-slate-400">({item.range})</span>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="pt-2 border-t border-slate-100 space-y-1">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-700">How to read this:</span>{' '}
            Each score is the average across all audited agencies. The threshold markers on each bar
            show the boundaries between compliance levels. Higher is always better.
          </p>
          <p className="text-xs text-slate-400">
            Based on automated GWT audits. Scores reflect the most recent audit per agency.
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Three metric bars */}
        <ScoreBar metaKey="webPresence" score={avgWebPresence} agencyCount={auditedAgencies.length} />
        <ScoreBar metaKey="webUsability" score={avgUsability} agencyCount={auditedAgencies.length} />
        <ScoreBar metaKey="contentQuality" score={avgContentQuality} agencyCount={auditedAgencies.length} />
      </CardContent>
    </Card>
  );
};