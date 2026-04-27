import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MultiSelectToolbarProps {
  title: string;
  selectedCount: number;
  totalCount: number;
  selectionEnabled: boolean;
  isBusy?: boolean;
  onToggleSelection: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  className?: string;
}

export function MultiSelectToolbar({
  title,
  selectedCount,
  totalCount,
  selectionEnabled,
  isBusy = false,
  onToggleSelection,
  onSelectAll,
  onClear,
  primaryActionLabel,
  onPrimaryAction,
  className,
}: MultiSelectToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[26px] border border-white/70 bg-white/74 p-4 shadow-[0_18px_40px_rgba(148,163,184,0.10)] backdrop-blur-md md:flex-row md:items-center md:justify-between',
        className
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
            {selectedCount}/{totalCount} selected
          </Badge>
        </div>
        <p className="text-sm text-slate-600">
          Select multiple items for faster bulk actions.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onToggleSelection} className="rounded-2xl">
          {selectionEnabled ? 'Hide Selection' : 'Select Multiple'}
        </Button>
        {selectionEnabled ? (
          <>
            <Button variant="outline" onClick={onSelectAll} className="rounded-2xl">
              Select All
            </Button>
            <Button variant="outline" onClick={onClear} className="rounded-2xl">
              Clear
            </Button>
            <Button
              onClick={onPrimaryAction}
              disabled={selectedCount === 0 || isBusy}
              className="rounded-2xl"
            >
              {isBusy ? 'Processing...' : primaryActionLabel}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
