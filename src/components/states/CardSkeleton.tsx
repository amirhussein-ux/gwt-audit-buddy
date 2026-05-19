import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

interface CardSkeletonProps {
  title?: string;
  description?: string;
  className?: string;
  variant?: 'default' | 'list' | 'stats';
  rows?: number;
}

export function CardSkeleton({
  title,
  description,
  className,
  variant = 'default',
  rows = 3,
}: CardSkeletonProps) {
  const renderBody = () => {
    if (variant === 'stats') {
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-[24px] border border-white/40 bg-white/70 p-4 shadow-[0_12px_30px_rgba(148,163,184,0.08)]">
              <Skeleton className="mb-4 h-4 w-10 rounded-full bg-slate-200/80" />
              <Skeleton className="mb-3 h-6 w-20 bg-slate-200/80" />
              <Skeleton className="h-3 w-24 bg-slate-200/70" />
            </div>
          ))}
        </div>
      );
    }

    if (variant === 'list') {
      return (
        <div className="space-y-3">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="rounded-2xl border border-white/50 bg-white/70 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-xl bg-slate-200/80" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/5 bg-slate-200/80" />
                  <Skeleton className="h-3 w-full bg-slate-200/70" />
                  <Skeleton className="h-3 w-3/4 bg-slate-200/70" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-[24px] bg-slate-200/70" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full bg-slate-200/70" />
          <Skeleton className="h-4 w-11/12 bg-slate-200/70" />
          <Skeleton className="h-4 w-3/4 bg-slate-200/70" />
        </div>
      </div>
    );
  };

  return (
    <Card className={cn(brandColors.surfaces.dashboardCard, 'bg-white/68', className)}>
      <CardHeader>
        <CardTitle className="text-base font-bold text-slate-900">
          {title ?? <Skeleton className="h-6 w-32 bg-slate-200/80" />}
        </CardTitle>
        {description ? (
          <CardDescription className="mt-1 text-xs leading-relaxed">{description}</CardDescription>
        ) : (
          <div className="mt-1">
            <Skeleton className="h-4 w-52 bg-slate-200/70" />
          </div>
        )}
      </CardHeader>
      <CardContent>{renderBody()}</CardContent>
    </Card>
  );
}
