import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

interface TableSkeletonProps {
  title?: string;
  description?: string;
  className?: string;
  rows?: number;
  columns?: number;
  showFilters?: boolean;
}

export function TableSkeleton({
  title,
  description,
  className,
  rows = 6,
  columns = 5,
  showFilters = true,
}: TableSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {showFilters ? (
        <Card className={cn(brandColors.surfaces.dashboardCard, 'bg-white/65')}>
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:flex-wrap md:items-center">
            <Skeleton className="h-11 min-w-[240px] flex-1 rounded-2xl bg-slate-200/70" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-11 w-32 rounded-2xl bg-slate-200/70" />
              <Skeleton className="h-11 w-32 rounded-2xl bg-slate-200/70" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className={cn(brandColors.surfaces.dashboardCard, 'bg-white/70')}>
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900">
            {title ?? <Skeleton className="h-6 w-36 bg-slate-200/80" />}
          </CardTitle>
          <CardDescription className="mt-1 text-xs leading-relaxed">
            {description ?? <Skeleton className="h-4 w-60 bg-slate-200/70" />}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }, (_, index) => (
              <Skeleton key={index} className="h-4 w-full bg-slate-200/70" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: rows }, (_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid gap-3 rounded-2xl border border-white/50 bg-white/70 p-4"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: columns }, (_, columnIndex) => (
                  <Skeleton key={columnIndex} className="h-4 w-full bg-slate-200/70" />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
