import type { ComponentType } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { brandColors } from "@/lib/brandColors";
import { cn } from "@/lib/utils";

interface NavItemProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  expanded: boolean;
  onClick: () => void;
}

export default function NavItem({
  icon: Icon,
  label,
  active = false,
  expanded,
  onClick,
}: NavItemProps) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        brandColors.sidebar.itemBase,
        brandColors.sidebar.itemFocus,
        expanded ? "w-full justify-start gap-3 px-4 py-3" : "size-12 justify-center p-0",
        active
          ? cn(
              brandColors.sidebar.active.bg,
              brandColors.sidebar.active.text,
              brandColors.sidebar.active.shadow
            )
          : cn(
              "bg-transparent",
              brandColors.sidebar.inactive.text,
              brandColors.sidebar.hover.bg,
              brandColors.sidebar.hover.text,
              brandColors.sidebar.hover.scale
            )
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors duration-200 ease-in-out",
          active ? brandColors.sidebar.active.icon : brandColors.sidebar.inactive.icon,
          !active && brandColors.sidebar.hover.icon
        )}
      />
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap text-sm transition-all duration-200 ease-in-out",
          expanded ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0",
          active ? cn(brandColors.sidebar.active.text, "font-medium") : brandColors.sidebar.inactive.text,
          !active && brandColors.sidebar.hover.text
        )}
      >
        {label}
      </span>
    </button>
  );

  if (expanded) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" className={brandColors.sidebar.tooltip}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
