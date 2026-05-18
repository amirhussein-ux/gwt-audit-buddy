import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

interface ChartSkeletonProps {
  title?: string;
  description?: string;
  className?: string;
  showLegend?: boolean;
}

export function ChartSkeleton({
  title,
  description,
  className,
  showLegend = true,
}: ChartSkeletonProps) {
  return (
    <Card className={cn(brandColors.surfaces.dashboardCard, 'bg-white/68', className)}>
      <CardHeader>
        <CardTitle className="text-base font-bold text-slate-900">
          {title ?? <Skeleton className="h-6 w-36 bg-slate-200/80" />}
        </CardTitle>
        <CardDescription className="mt-1 text-xs leading-relaxed">
          {description ?? <Skeleton className="h-4 w-56 bg-slate-200/70" />}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-2xl border border-white/50 bg-white/70 p-4">
              <Skeleton className="mb-3 h-3 w-16 bg-slate-200/70" />
              <Skeleton className="mb-2 h-7 w-20 bg-slate-200/80" />
              <Skeleton className="h-3 w-24 bg-slate-200/70" />
            </div>
          ))}
        </div>
        {showLegend ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-full bg-slate-200/70" />
            ))}
          </div>
        ) : null}
        <div className="rounded-[24px] border border-white/50 bg-white/70 p-5">
          <Skeleton className="h-64 w-full rounded-[18px] bg-slate-200/70" />
        </div>
      </CardContent>
    </Card>
  );
}
