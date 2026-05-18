import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';
import { InfoBubble } from '@/components/InfoBubble';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/states';

interface CriticalAlert {
  _id: string;
  agency: {
    _id: string;
    name: string;
    acronym: string;
  };
  complianceStatus?: string;
  criticalIssues?: Array<{
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }>;
}

interface CriticalAlertsData {
  alerts: CriticalAlert[];
  total: number;
}

// Constants
const ALERTS_CONFIG = {
  CARD_CLASS: 'col-span-2',
  LOADING_HEIGHT: 'h-64',
  ITEMS_MAX_HEIGHT: 'max-h-96',
  BORDER_WIDTH: 'h-4',
  BORDER_LEFT_WIDTH: 'border-l-4',
  EMPTY_HEIGHT: 'h-32',
};

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
};

const SEVERITY_THRESHOLDS = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Helper functions
const getSeverityColor = (severity: string) => {
  return SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.high;
};

const getIssueIcon = (severity: string) => {
  return severity === 'critical' ? (
    <AlertTriangle className="h-4 w-4" />
  ) : (
    <AlertCircle className="h-4 w-4" />
  );
};

// Helper Components
interface AlertItemProps {
  alert: CriticalAlert;
  index: number;
}

const AlertItem = ({ alert, index }: AlertItemProps) => {
  const severity = alert.criticalIssues?.[0]?.severity || 'high';
  return (
    <div className={`${ALERTS_CONFIG.BORDER_LEFT_WIDTH} border-red-500 p-3 bg-red-50 rounded`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          {getIssueIcon(severity)}
          <div className="flex-1">
            <p className="font-medium text-sm">{alert.agency?.name}</p>
            <p className="text-xs text-slate-600 mt-1">
              {alert.criticalIssues?.[0]?.description ||
                'Missing critical compliance requirement'}
            </p>
          </div>
        </div>
        <Badge className={getSeverityColor(severity)}>
          {severity.toUpperCase()}
        </Badge>
      </div>
    </div>
  );
};

export const CriticalAlertsTable = () => {
  const { token } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['critical-alerts'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/dashboard/critical-alerts`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch critical alerts');
      return response.json().catch(() => ({ alerts: [], total: 0 })) as Promise<CriticalAlertsData>;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <CardSkeleton
        title="Critical Alerts"
        description="Agencies with missing PST, Transparency Seals, or low accessibility"
        variant="list"
        className={ALERTS_CONFIG.CARD_CLASS}
      />
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Critical alerts are unavailable"
        description={error instanceof Error ? error.message : 'The alert feed could not be loaded right now.'}
        onRetry={() => void refetch()}
        retryLabel={isFetching ? 'Retrying...' : 'Retry'}
        isRetrying={isFetching}
        className={ALERTS_CONFIG.CARD_CLASS}
      />
    );
  }

  const alerts = Array.isArray(data.alerts) ? data.alerts : [];

  return (
    <Card className={cn(ALERTS_CONFIG.CARD_CLASS, brandColors.surfaces.dashboardCard)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Critical Alerts</CardTitle>
            <CardDescription>Agencies requiring immediate attention ({data?.total || alerts.length} total)</CardDescription>
          </div>
          <div data-export-ignore="true">
            <InfoBubble
              title="Critical Alerts"
              summary="This card highlights agencies with the most urgent compliance gaps so teams can respond faster."
              sections={[
                { title: 'What appears here', body: 'Missing PST, missing Transparency Seal, and other high-severity findings are surfaced first.' },
                { title: 'How to use it', body: 'Treat this as a triage list for immediate follow-up, especially when issues affect trust or public access.' },
              ]}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length > 0 ? (
          <div className={`space-y-3 ${ALERTS_CONFIG.ITEMS_MAX_HEIGHT} overflow-y-auto`}>
            {alerts.map((alert, index) => (
              <AlertItem key={alert._id || `alert-${index}`} alert={alert} index={index} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No critical alerts"
            description="All agencies are currently in compliance."
            icon={<AlertTriangle className="h-6 w-6 text-emerald-500" />}
            compact
            className="border-0 bg-transparent shadow-none"
          />
        )}
      </CardContent>
    </Card>
  );
};
