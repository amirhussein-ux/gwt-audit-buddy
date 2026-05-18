import type { FallbackProps } from 'react-error-boundary';

import { AlertTriangle } from 'lucide-react';

import { ErrorState } from '@/components/states';
import { cn } from '@/lib/utils';

interface RouteErrorFallbackProps extends FallbackProps {
  title?: string;
  description?: string;
  fullPage?: boolean;
  className?: string;
}

const isDevelopment = import.meta.env.DEV;

export function RouteErrorFallback({
  error,
  resetErrorBoundary,
  title = 'This page hit an unexpected problem',
  description = 'You can try again without leaving the rest of the application.',
  fullPage = true,
  className,
}: RouteErrorFallbackProps) {
  return (
    <div
      className={cn(
        fullPage ? 'min-h-screen bg-background px-4 py-6 sm:px-6' : 'min-h-[40vh] px-4 py-6 sm:px-0',
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <ErrorState
          title={title}
          description={description}
          onRetry={resetErrorBoundary}
          retryLabel="Try again"
          fullPage={fullPage}
          icon={<AlertTriangle className="h-6 w-6" aria-hidden="true" />}
        />

        {isDevelopment && error?.message ? (
          <details className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
            <summary className="cursor-pointer font-medium">Development details</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs">{error.message}</pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
