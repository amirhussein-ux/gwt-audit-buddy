import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Globe, MonitorSmartphone, FileText } from 'lucide-react';
import { InfoBubble } from '@/components/InfoBubble';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';
import { ChartSkeleton, EmptyState, ErrorState } from '@/components/states';

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

const MATURITY_CONFIG = {
  THRESHOLDS: {
    EXCELLENT: 90,
    GOOD: 75,
    DEVELOPING: 50,
  },
};

const METRIC_META = {
  webPresence: {
    label: 'Web Presence',
    icon: Globe,
    colorClass: {
      text: 'text-blue-600',
      bg: 'bg-blue-600',
      light: 'bg-blue-50',
    },
    what: 'Is the website clearly identifiable as an official government site?',
    why: 'This measures whether expected public signals such as PST, seals, and core agency information are present.',
    goodSign: 'Citizens can quickly confirm the site is official and complete.',
    badSign: 'The site may feel incomplete or missing required public-facing government markers.',
  },
  webUsability: {
    label: 'Web Usability',
    icon: MonitorSmartphone,
    colorClass: {
      text: 'text-emerald-600',
      bg: 'bg-emerald-600',
      light: 'bg-emerald-50',
    },
    what: 'Is the site easy for people to navigate and use?',
    why: 'This captures accessibility and usability practices that directly affect how citizens experience the site.',
    goodSign: 'People can reach information with fewer barriers and less confusion.',
    badSign: 'Citizens may struggle with readability, navigation, or accessible interaction.',
  },
  contentQuality: {
    label: 'Content Quality',
    icon: FileText,
    colorClass: {
      text: 'text-violet-600',
      bg: 'bg-violet-600',
      light: 'bg-violet-50',
    },
    what: 'Is the information clear, useful, and complete?',
    why: 'This highlights whether an agency site communicates what it does and what citizens need to act on.',
    goodSign: 'Users can understand the agency and find key content fast.',
    badSign: 'Important information may be buried, unclear, or incomplete.',
  },
} as const;

function getMaturityLabel(score: number) {
  if (score >= MATURITY_CONFIG.THRESHOLDS.EXCELLENT) {
    return { label: 'Excellent', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', description: 'Meets or exceeds core GWT expectations.' };
  }
  if (score >= MATURITY_CONFIG.THRESHOLDS.GOOD) {
    return { label: 'Good', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300', description: 'Strong compliance with a few remaining gaps.' };
  }
  if (score >= MATURITY_CONFIG.THRESHOLDS.DEVELOPING) {
    return { label: 'Developing', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', description: 'A workable base with clear improvement areas.' };
  }
  return { label: 'Needs Attention', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', description: 'Significant compliance gaps remain.' };
}

function ScoreBar({
  metaKey,
  score,
  agencyCount,
}: {
  metaKey: keyof typeof METRIC_META;
  score: number;
  agencyCount: number;
}) {
  const meta = METRIC_META[metaKey];
  const maturity = getMaturityLabel(score);
  const Icon = meta.icon;
  const clampedScore = Math.min(100, Math.max(0, score));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`rounded-md p-1.5 ${meta.colorClass.light}`}>
            <Icon className={`h-4 w-4 ${meta.colorClass.text}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-800">{meta.label}</span>
              <InfoBubble
                title={meta.label}
                summary={meta.what}
                sections={[
                  { title: 'Why it matters', body: meta.why },
                  { title: 'High score', body: meta.goodSign },
                  { title: 'Low score', body: meta.badSign },
                  { title: 'Coverage', body: `Average across ${agencyCount} audited ${agencyCount === 1 ? 'agency' : 'agencies'}.` },
                ]}
                className="h-7 px-2.5"
              />
            </div>
            <p className="truncate text-xs text-slate-500">{meta.what}</p>
          </div>
        </div>

        <div className="text-right">
          <span className={`text-lg font-bold ${meta.colorClass.text}`}>{clampedScore.toFixed(1)}%</span>
          <div className={`mt-0.5 rounded-full border px-1.5 py-0.5 text-center text-xs font-medium ${maturity.bg} ${maturity.color} ${maturity.border}`}>
            {maturity.label}
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-2.5 rounded-full ${meta.colorClass.bg}`} style={{ width: `${clampedScore}%` }} />
        </div>
        <div className="absolute left-[50%] top-0 h-2.5 w-px bg-slate-300 opacity-60" />
        <div className="absolute left-[75%] top-0 h-2.5 w-px bg-slate-300 opacity-60" />
        <div className="absolute left-[90%] top-0 h-2.5 w-px bg-slate-300 opacity-60" />
      </div>

      <div className="flex justify-between px-0.5 text-[10px] text-slate-400">
        <span>Needs Attention</span>
        <span className="ml-auto mr-[25%]">Developing</span>
        <span className="mr-[10%]">Good</span>
        <span>Excellent</span>
      </div>
    </div>
  );
}

function OverallBadge({ score, agencyCount }: { score: number; agencyCount: number }) {
  const maturity = getMaturityLabel(score);
  return (
    <div className={`rounded-xl border-2 p-4 ${maturity.bg} ${maturity.border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Overall Compliance</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${maturity.color}`}>{score.toFixed(1)}%</span>
            <span className={`text-sm font-semibold ${maturity.color}`}>{maturity.label}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{maturity.description}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-700">{agencyCount}</p>
          <p className="text-xs text-slate-500">{agencyCount === 1 ? 'Agency' : 'Agencies'} audited</p>
        </div>
      </div>
    </div>
  );
}

export const MaturityRadarChart = () => {
  const { token } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['maturity-index'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/dashboard/maturity-index`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch maturity index');
      return response.json().catch(() => ({ agencies: [] })) as Promise<MaturityData>;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return <ChartSkeleton title="Maturity Index" description="Government website compliance overview" showLegend={false} />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Maturity data is unavailable"
        description={error instanceof Error ? error.message : 'The maturity index could not be loaded right now.'}
        onRetry={() => void refetch()}
        retryLabel={isFetching ? 'Retrying...' : 'Retry'}
        isRetrying={isFetching}
      />
    );
  }

  const agencies = Array.isArray(data.agencies) ? data.agencies : [];
  const auditedAgencies = agencies.filter((agency) => agency.latestScore);

  if (auditedAgencies.length === 0) {
    return (
      <EmptyState
        title="No maturity data yet"
        description="Run at least one completed audit to populate the maturity index."
        compact
      />
    );
  }

  const webPresenceSources = auditedAgencies.filter((agency) => typeof agency.latestScore?.webPresence?.averageScore === 'number');
  const usabilitySources = auditedAgencies.filter((agency) => typeof (agency.latestScore?.webUsability?.total ?? agency.latestScore?.webUsability?.accessibility) === 'number');
  const contentSources = auditedAgencies.filter((agency) => typeof agency.latestScore?.overallScore === 'number');

  const avgWebPresence = webPresenceSources.reduce((sum, agency) => sum + (agency.latestScore?.webPresence?.averageScore ?? 0), 0) / (webPresenceSources.length || 1);
  const avgUsability = usabilitySources.reduce((sum, agency) => sum + (agency.latestScore?.webUsability?.total ?? agency.latestScore?.webUsability?.accessibility ?? 0), 0) / (usabilitySources.length || 1);
  const avgContentQuality = contentSources.reduce((sum, agency) => sum + (agency.latestScore?.overallScore ?? 0), 0) / (contentSources.length || 1);
  const overallScore = (avgWebPresence + avgUsability + avgContentQuality) / 3;

  return (
    <Card className={cn('overflow-hidden', brandColors.surfaces.dashboardCard)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold">Maturity Index</CardTitle>
            <CardDescription className="mt-1 text-xs leading-relaxed">
              A quick read on how strongly audited agencies are meeting DICT GWT expectations.
            </CardDescription>
          </div>
          <div data-export-ignore="true">
            <InfoBubble
              title="Maturity Index"
              summary="This overview combines the major website dimensions into one quick-read compliance maturity snapshot."
              sections={[
                { title: 'What it means', body: 'Higher scores indicate a more complete, usable, and citizen-ready government website experience.' },
                { title: 'How to use it', body: 'Use the overall badge for fast direction, then inspect the three bars to see where the biggest gaps are.' },
              ]}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <OverallBadge score={overallScore} agencyCount={auditedAgencies.length} />

        <div className="flex flex-wrap gap-2 text-[10px]">
          {[
            { label: 'Needs Attention', color: 'bg-red-400', range: '< 50%' },
            { label: 'Developing', color: 'bg-amber-400', range: '50-74%' },
            { label: 'Good', color: 'bg-blue-400', range: '75-89%' },
            { label: 'Excellent', color: 'bg-emerald-400', range: '90-100%' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1 text-slate-500">
              <div className={`h-2 w-2 rounded-full ${item.color}`} />
              <span>{item.label}</span>
              <span className="text-slate-400">({item.range})</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-slate-100 pt-2">
          <p className="text-xs leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-700">How to read this:</span> each score is the average across all audited agencies. Higher is better.
          </p>
          <p className="text-xs text-slate-400">
            Based on the most recent automated audit available for each agency.
          </p>
        </div>

        <div className="border-t border-slate-100" />

        <ScoreBar metaKey="webPresence" score={avgWebPresence} agencyCount={auditedAgencies.length} />
        <ScoreBar metaKey="webUsability" score={avgUsability} agencyCount={auditedAgencies.length} />
        <ScoreBar metaKey="contentQuality" score={avgContentQuality} agencyCount={auditedAgencies.length} />
      </CardContent>
    </Card>
  );
};
