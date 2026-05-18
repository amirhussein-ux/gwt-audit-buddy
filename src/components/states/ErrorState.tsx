import type { ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void | Promise<void>;
  retryLabel?: string;
  icon?: ReactNode;
  compact?: boolean;
  fullPage?: boolean;
  className?: string;
  isRetrying?: boolean;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this content right now. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  icon,
  compact = false,
  fullPage = false,
  className,
  isRetrying = false,
}: ErrorStateProps) {
  const content = (
    <Card
      className={cn(
        brandColors.surfaces.dashboardCard,
        'border-red-200/80 bg-[linear-gradient(135deg,rgba(254,242,242,0.98),rgba(255,255,255,0.9))]',
        className
      )}
    >
      <CardContent className={cn('flex flex-col items-center text-center', compact ? 'gap-3 px-4 py-6' : 'gap-4 px-6 py-10')}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-200 bg-white/90 text-red-500 shadow-sm">
          {icon ?? <AlertCircle className="h-6 w-6" aria-hidden="true" />}
        </div>
        <div className="space-y-1">
          <h2 className={cn('font-semibold text-slate-900', compact ? 'text-base' : 'text-lg')}>{title}</h2>
          <p className={cn('mx-auto max-w-xl text-slate-600', compact ? 'text-sm' : 'text-sm leading-6')}>{description}</p>
        </div>
        {onRetry ? (
          <Button
            type="button"
            onClick={() => void onRetry()}
            disabled={isRetrying}
            size={compact ? 'sm' : 'default'}
            className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-500 text-white hover:from-violet-500 hover:to-indigo-500"
          >
            <RefreshCw className={cn('mr-2', isRetrying && 'animate-spin', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
            {retryLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="alert" aria-live="assertive">
        <div className="w-full max-w-2xl">{content}</div>
      </div>
    );
  }

  return (
    <div role="alert" aria-live="assertive">
      {content}
    </div>
  );
}
