import { CardSkeleton } from '@/components/states/CardSkeleton';
import { TableSkeleton } from '@/components/states/TableSkeleton';
import { cn } from '@/lib/utils';

interface PageSkeletonProps {
  className?: string;
  variant?: 'cards' | 'table';
  cardCount?: number;
  showFilters?: boolean;
}

export function PageSkeleton({
  className,
  variant = 'cards',
  cardCount = 2,
  showFilters = true,
}: PageSkeletonProps) {
  if (variant === 'table') {
    return <TableSkeleton className={className} showFilters={showFilters} />;
  }

  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: cardCount }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}
