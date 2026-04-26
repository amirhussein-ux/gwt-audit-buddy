import { Menu } from "lucide-react";
import { useLocation } from "react-router-dom";

import NotificationCenter from "./NotificationCenter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardSidebar } from "@/contexts/DashboardSidebarContext";
import { brandColors } from "@/lib/brandColors";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Run audits, monitor progress, and review the latest signals.",
  },
  "/results": {
    title: "Results",
    subtitle: "Review completed audits and drill into compliance outcomes.",
  },
  "/audit-log": {
    title: "Audit Log",
    subtitle: "Track active and historical audit activity across the system.",
  },
  "/archive": {
    title: "Archive",
    subtitle: "Restore or inspect archived audit records and reports.",
  },
  "/profile": {
    title: "Profile",
    subtitle: "Manage account details for your shared audit workspace.",
  },
  "/settings": {
    title: "Settings",
    subtitle: "Tune audit defaults, dashboard visibility, and notifications.",
  },
};

const getPageMeta = (pathname: string) => {
  if (pathname.startsWith("/audit/")) {
    return {
      title: "Audit Details",
      subtitle: "Inspect the detailed findings and scoring behind a completed run.",
    };
  }

  return (
    PAGE_TITLES[pathname] || {
      title: "MASID",
      subtitle: "Monitoring and Automated Standards Inspection Dashboard",
    }
  );
};

export default function Header() {
  const location = useLocation();
  const { user } = useAuth();
  const { isMobile, setMobileOpen } = useDashboardSidebar();
  const pageMeta = getPageMeta(location.pathname);
  const profileLabel = user?.fullName || user?.username || "MASID";
  const profileMeta = user?.positionTitle || user?.role || "Audit workspace";
  const initials = profileLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return (
    <header className={cn("sticky top-0 z-30 h-16", brandColors.appShell.header)}>
      <div
        className={cn(
          "flex h-full items-center justify-between gap-4",
          brandColors.appShell.contentPadding
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {isMobile && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className={cn("size-10", brandColors.sidebar.iconButton)}
            >
              <Menu className="size-4" />
              <span className="sr-only">Open navigation</span>
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-800">{pageMeta.title}</h1>
            <p className="hidden truncate text-xs text-slate-500 sm:block">{pageMeta.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NotificationCenter />
          <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/75 px-3 py-2 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
            <Avatar className="h-9 w-9 border border-white/60">
              <AvatarFallback className="bg-gradient-to-br from-violet-100 to-sky-50 text-xs font-semibold text-violet-700">
                {initials || "M"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-medium text-slate-700">{profileLabel}</p>
              <p className="truncate text-xs text-slate-500">{profileMeta}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
