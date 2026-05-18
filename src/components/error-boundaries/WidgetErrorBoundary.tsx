import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { WidgetErrorFallback } from './WidgetErrorFallback';

type WidgetFallbackMode = 'card' | 'inline';

interface WidgetErrorBoundaryProps {
  children: ReactNode;
  title: string;
  description?: string;
  className?: string;
  mode?: WidgetFallbackMode;
  resetKeys?: unknown[];
  onReset?: () => void;
}

export function WidgetErrorBoundary({
  children,
  title,
  description,
  className,
  mode = 'card',
  resetKeys,
  onReset,
}: WidgetErrorBoundaryProps) {
  return (
    <ErrorBoundary
      resetKeys={resetKeys}
      onReset={onReset}
      onError={(error, info) => {
        if (import.meta.env.DEV) {
          console.error(`[WidgetErrorBoundary:${title}] Caught render error:`, error, info.componentStack);
        }
      }}
      fallbackRender={(props) => (
        <WidgetErrorFallback
          {...props}
          title={title}
          description={description}
          className={className}
          mode={mode}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
