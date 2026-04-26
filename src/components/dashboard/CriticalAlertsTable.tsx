import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

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

  const { data, isLoading } = useQuery({
    queryKey: ['critical-alerts'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/dashboard/critical-alerts`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch critical alerts');
      return response.json() as Promise<CriticalAlertsData>;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <Card className={cn(ALERTS_CONFIG.CARD_CLASS, brandColors.surfaces.dashboardCard)}>
        <CardHeader>
          <CardTitle>Critical Alerts</CardTitle>
          <CardDescription>Agencies with missing PST, Transparency Seals, or low accessibility</CardDescription>
        </CardHeader>
        <CardContent className={`${ALERTS_CONFIG.LOADING_HEIGHT} flex items-center justify-center`}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getIssueIcon = (severity: string) => {
    return severity === 'critical' ? (
      <AlertTriangle className="h-4 w-4" />
    ) : (
      <AlertCircle className="h-4 w-4" />
    );
  };

  return (
    <Card className={cn(ALERTS_CONFIG.CARD_CLASS, brandColors.surfaces.dashboardCard)}>
      <CardHeader>
        <CardTitle>Critical Alerts</CardTitle>
        <CardDescription>Agencies requiring immediate attention ({data?.total || 0} total)</CardDescription>
      </CardHeader>
      <CardContent>
        {(data?.alerts || []).length > 0 ? (
          <div className={`space-y-3 ${ALERTS_CONFIG.ITEMS_MAX_HEIGHT} overflow-y-auto`}>
            {(data?.alerts || []).map((alert, index) => (
              <AlertItem key={alert._id || `alert-${index}`} alert={alert} index={index} />
            ))}
          </div>
        ) : (
          <div className={`${ALERTS_CONFIG.EMPTY_HEIGHT} flex items-center justify-center text-slate-500`}>
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>No critical alerts</p>
              <p className="text-xs mt-1">All agencies are in compliance</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
