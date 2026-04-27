import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface InfoBubbleSection {
  title: string;
  body: string;
}

interface InfoBubbleProps {
  title: string;
  summary?: string;
  sections?: InfoBubbleSection[];
  className?: string;
  align?: 'start' | 'center' | 'end';
}

export function InfoBubble({
  title,
  summary,
  sections = [],
  className,
  align = 'end',
}: InfoBubbleProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 rounded-full border border-sky-200 bg-sky-50 px-3 text-xs font-medium text-sky-700 hover:bg-sky-100 hover:text-sky-800',
            className
          )}
        >
          <Info className="mr-1.5 h-3.5 w-3.5" />
          Learn more
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={10}
        className="w-[320px] rounded-[24px] border-sky-100 bg-white/98 p-0 shadow-[0_20px_50px_rgba(14,116,144,0.18)]"
      >
        <div className="rounded-[24px] bg-[radial-gradient(circle_at_top_right,rgba(186,230,253,0.5),transparent_42%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))] p-4">
          <div className="rounded-2xl border border-white/80 bg-white/92 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            {summary ? <p className="mt-2 text-sm leading-6 text-slate-600">{summary}</p> : null}
            {sections.length > 0 ? (
              <div className="mt-3 space-y-3">
                {sections.map((section) => (
                  <div key={section.title} className="rounded-2xl bg-slate-50 px-3 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {section.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{section.body}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
