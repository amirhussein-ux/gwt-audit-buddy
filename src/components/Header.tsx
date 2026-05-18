import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Flag, ChevronDown, LogOut, Menu, Settings, UserCircle2 } from "lucide-react";

import { WidgetErrorBoundary } from "@/components/error-boundaries/WidgetErrorBoundary";
import NotificationCenter from "./NotificationCenter";
import ReportProblemModal from "./ReportProblemModal";
import ConfirmationDialogComponent from "./ConfirmationDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isMobile, setMobileOpen } = useDashboardSidebar();

  const [profileOpen, setProfileOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const pageMeta = getPageMeta(location.pathname);
  const profileLabel = user?.fullName || user?.username || "MASID";
  const initials = profileLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  const handleNavigate = (path: string) => {
    navigate(path);
    setProfileOpen(false);
  };

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setLogoutDialogOpen(false);
      setProfileOpen(false);
      navigate("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <header className={cn("sticky top-0 z-30 h-16", brandColors.appShell.header)}>
        <div className={cn("flex h-full items-center justify-between gap-4", brandColors.appShell.contentPadding)}>
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
            <WidgetErrorBoundary
              title="Notifications"
              description="Notifications are temporarily unavailable, but the rest of the header is still working."
              mode="inline"
            >
              <NotificationCenter />
            </WidgetErrorBoundary>

            {/* Profile Dropdown */}
            <Popover open={profileOpen} onOpenChange={setProfileOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-2 rounded-xl border border-white/40 bg-white/60 px-2.5 py-1.5",
                    "transition-colors duration-200",
                    "hover:bg-white/75",
                    "focus:outline-none focus:ring-2 focus:ring-violet-300/60 focus:ring-offset-0",
                    "cursor-pointer"
                  )}
                  aria-label="Open profile menu"
                >
                  <Avatar className="h-8 w-8 border border-white/40">
                    <AvatarFallback className="bg-gradient-to-br from-violet-100 to-sky-50 text-xs font-semibold text-violet-700">
                      {initials || "M"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-slate-700">{profileLabel}</span>
                  <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </PopoverTrigger>

              <PopoverContent align="end" className="w-48 p-0">
                <div className="rounded-md border border-slate-200/70 bg-white/95 p-1 shadow-md">
                  {/* Profile */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => handleNavigate("/profile")}
                  >
                    <UserCircle2 className="h-4 w-4 text-slate-600" />
                    <span>Profile</span>
                  </button>

                  {/* Settings */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => handleNavigate("/settings")}
                  >
                    <Settings className="h-4 w-4 text-slate-600" />
                    <span>Settings</span>
                  </button>

                  {/* Report a problem */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setReportModalOpen(true);
                      setProfileOpen(false);
                    }}
                  >
                    <Flag className="h-4 w-4 text-amber-600" />
                    <span>Report a problem</span>
                  </button>

                  <div className="my-1 h-px bg-slate-200/70" />

                  {/* Log out */}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 text-sm text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setLogoutDialogOpen(true);
                      setProfileOpen(false);
                    }}
                  >
                    <LogOut className="h-4 w-4 text-red-600" />
                    <span>Log out</span>
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>

      {/* Report Problem Modal */}
      <ReportProblemModal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} />

      {/* Logout Confirmation Dialog */}
      <ConfirmationDialogComponent
        isOpen={logoutDialogOpen}
        title="Sign out?"
        description="Are you sure you want to sign out? You'll need to log in again to access your audit dashboard."
        confirmText="Sign Out"
        cancelText="Cancel"
        variant="warning"
        isLoading={isLoggingOut}
        onConfirm={handleLogoutConfirm}
        onCancel={() => setLogoutDialogOpen(false)}
      />
    </>
  );
}
