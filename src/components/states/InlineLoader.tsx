import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface InlineLoaderProps {
  label?: string;
  icon?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function InlineLoader({
  label = 'Loading',
  icon,
  className,
  compact = false,
}: InlineLoaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 text-slate-500',
        compact ? 'py-2 text-xs' : 'py-4 text-sm',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">
        {icon ?? <Loader2 className={cn('animate-spin', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />}
      </span>
      <span>{label}</span>
    </div>
  );
}
