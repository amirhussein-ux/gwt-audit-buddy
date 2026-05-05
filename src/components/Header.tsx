import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  Settings,
  UserCircle2,
  LogOut,
  Flag,
  ChevronDown,
} from "lucide-react";

import NotificationCenter from "./NotificationCenter";
import ReportProblemModal from "./ReportProblemModal";
import ConfirmationDialogComponent from "./ConfirmationDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const pageMeta = getPageMeta(location.pathname);
  const profileLabel = user?.fullName || user?.username || "MASID";
  const profileMeta = user?.positionTitle || user?.role || "Audit workspace";
  const initials = profileLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  const handleNavigate = (path: string) => {
    navigate(path);
    setDropdownOpen(false);
  };

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setLogoutDialogOpen(false);
      setDropdownOpen(false);
      navigate("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
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
              <h1 className="truncate text-base font-semibold text-slate-800">
                {pageMeta.title}
              </h1>
              <p className="hidden truncate text-xs text-slate-500 sm:block">
                {pageMeta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationCenter />

            {/* Profile Dropdown */}
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 rounded-xl border border-white/40 bg-white/60 px-2.5 py-1.5",
                    "transition-colors duration-200",
                    "hover:bg-white/75",
                    "focus:outline-none focus:ring-2 focus:ring-violet-300/60 focus:ring-offset-0",
                    "cursor-pointer"
                  )}
                >
                  <Avatar className="h-8 w-8 border border-white/40">
                    <AvatarFallback className="bg-gradient-to-br from-violet-100 to-sky-50 text-xs font-semibold text-violet-700">
                      {initials || "M"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-slate-700">
                    {profileLabel}
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {/* Profile */}
                <DropdownMenuItem
                  onClick={() => handleNavigate("/profile")}
                  className="flex items-center gap-2 cursor-pointer rounded-lg transition-colors hover:bg-slate-50"
                >
                  <UserCircle2 className="h-4 w-4 text-slate-600" />
                  <span className="text-sm text-slate-700">Profile</span>
                </DropdownMenuItem>

                {/* Settings */}
                <DropdownMenuItem
                  onClick={() => handleNavigate("/settings")}
                  className="flex items-center gap-2 cursor-pointer rounded-lg transition-colors hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4 text-slate-600" />
                  <span className="text-sm text-slate-700">Settings</span>
                </DropdownMenuItem>

                {/* Report a problem */}
                <DropdownMenuItem
                  onClick={() => {
                    setReportModalOpen(true);
                    setDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer rounded-lg transition-colors hover:bg-slate-50"
                >
                  <Flag className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-slate-700">Report a problem</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Log out */}
                <DropdownMenuItem
                  onClick={() => {
                    setLogoutDialogOpen(true);
                    setDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer rounded-lg transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-700">Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
