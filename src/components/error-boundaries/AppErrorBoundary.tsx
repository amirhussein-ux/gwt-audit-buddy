import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { RouteErrorFallback } from './RouteErrorFallback';

interface AppErrorBoundaryProps {
  children: ReactNode;
  resetKeys?: unknown[];
  title?: string;
  description?: string;
  fullPage?: boolean;
  className?: string;
  onReset?: () => void;
}

export function AppErrorBoundary({
  children,
  resetKeys,
  title,
  description,
  fullPage = true,
  className,
  onReset,
}: AppErrorBoundaryProps) {
  return (
    <ErrorBoundary
      resetKeys={resetKeys}
      onReset={onReset}
      onError={(error, info) => {
        if (import.meta.env.DEV) {
          console.error('[AppErrorBoundary] Caught render error:', error, info.componentStack);
        }
      }}
      fallbackRender={(props) => (
        <RouteErrorFallback
          {...props}
          title={title}
          description={description}
          fullPage={fullPage}
          className={className}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
