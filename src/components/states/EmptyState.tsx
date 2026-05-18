import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn(brandColors.surfaces.dashboardCard, 'border-dashed bg-white/60', className)}>
      <CardContent className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-3 px-4 py-8' : 'gap-4 px-6 py-14')}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-400 shadow-sm">
          {icon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
        </div>
        <div className="space-y-1">
          <h2 className={cn('font-medium text-slate-900', compact ? 'text-base' : 'text-lg')}>{title}</h2>
          {description ? (
            <p className={cn('mx-auto max-w-xl text-slate-600', compact ? 'text-sm' : 'text-sm leading-6')}>{description}</p>
          ) : null}
        </div>
        {actionLabel && onAction ? (
          <Button
            type="button"
            onClick={onAction}
            size={compact ? 'sm' : 'default'}
            className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-500 text-white hover:from-violet-500 hover:to-indigo-500"
          >
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
