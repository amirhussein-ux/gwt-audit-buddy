import type { FallbackProps } from 'react-error-boundary';

import { AlertTriangle } from 'lucide-react';

import { ErrorState } from '@/components/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

type WidgetFallbackMode = 'card' | 'inline';

interface WidgetErrorFallbackProps extends FallbackProps {
  title: string;
  description?: string;
  className?: string;
  mode?: WidgetFallbackMode;
}

const isDevelopment = import.meta.env.DEV;

export function WidgetErrorFallback({
  error,
  resetErrorBoundary,
  title,
  description = 'This section ran into an unexpected issue. You can retry it without disrupting the rest of the page.',
  className,
  mode = 'card',
}: WidgetErrorFallbackProps) {
  const content = (
    <>
      <ErrorState
        title={`${title} is temporarily unavailable`}
        description={description}
        onRetry={resetErrorBoundary}
        retryLabel="Retry section"
        compact
        icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
        className="border-0 bg-transparent shadow-none"
      />

      {isDevelopment && error?.message ? (
        <details className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-left text-xs text-amber-900">
          <summary className="cursor-pointer font-medium">Development details</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono">{error.message}</pre>
        </details>
      ) : null}
    </>
  );

  if (mode === 'inline') {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={cn(brandColors.surfaces.dashboardCard, className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
        <CardDescription className="text-sm text-slate-500">{description}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
