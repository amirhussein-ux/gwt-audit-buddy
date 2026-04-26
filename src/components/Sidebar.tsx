import { useMemo, useState, type ComponentType } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  UserCircle2,
} from "lucide-react";

import ConfirmationDialog from "@/components/ConfirmationDialog";
import NavItem from "@/components/sidebar/NavItem";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardSidebar } from "@/contexts/DashboardSidebarContext";
import { brandColors } from "@/lib/brandColors";
import { cn } from "@/lib/utils";

interface SidebarNavSection {
  id: string;
  label: string;
  items: Array<{
    id: string;
    label: string;
    path: string;
    icon: ComponentType<{ className?: string }>;
  }>;
}

const SIDEBAR_SECTIONS: SidebarNavSection[] = [
  {
    id: "main",
    label: "Main",
    items: [
      { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { id: "results", label: "Results", path: "/results", icon: FileText },
      { id: "archive", label: "Archive", path: "/archive", icon: Archive },
      { id: "audit-log", label: "Audit Log", path: "/audit-log", icon: Clock },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { id: "profile", label: "Profile", path: "/profile", icon: UserCircle2 },
      { id: "settings", label: "Settings", path: "/settings", icon: Settings },
    ],
  },
];

const ADMIN_ONLY_PATHS = ["/archive"];

function SidebarBody({
  expanded,
  onNavigate,
  onLogout,
}: {
  expanded: boolean;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  const location = useLocation();
  const { user } = useAuth();

  const sections = useMemo(() => {
    if (user?.role === "admin") {
      return SIDEBAR_SECTIONS;
    }

    // Filter out admin-only paths for non-admin users
    return SIDEBAR_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => !ADMIN_ONLY_PATHS.includes(item.path)),
    }));
  }, [user?.role]);

  const isActive = (path: string) => {
    if (path === "/results") {
      return location.pathname === "/results" || location.pathname.startsWith("/audit/");
    }

    return location.pathname === path;
  };

  return (
    <div className={cn(brandColors.sidebar.panel, "flex h-full flex-col text-slate-800")}>
      <div className="border-b border-white/40 px-4 py-5">
        <div className={cn("flex items-center", expanded ? "gap-3" : "justify-center")}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 via-fuchsia-50 to-sky-50 shadow-[0_12px_24px_rgba(129,140,248,0.14)]">
            <img src="/masidlogonobg.png" alt="MASID" className="h-7 w-7 object-contain" />
          </div>
          <div
            className={cn(
              "overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out",
              expanded ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
            )}
          >
            <p className="text-sm font-semibold text-slate-800">MASID</p>
            <p className="text-xs text-slate-500">Audit dashboard</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 px-3 py-6">

        {sections.map((section) => (
          <div key={section.id} className="space-y-2">
            <div className={cn("overflow-hidden transition-all duration-200 ease-in-out", expanded ? "max-h-8 opacity-100" : "max-h-0 opacity-0")}>
              <p className={brandColors.sidebar.sectionLabel}>{section.label}</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              {section.items.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  active={isActive(item.path)}
                  expanded={expanded}
                  onClick={() => onNavigate(item.path)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-white/40 px-3 py-4">
        <div className="flex justify-center">
          <NavItem
            icon={LogOut}
            label="Sign out"
            expanded={expanded}
            onClick={onLogout}
          />
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { isMobile, mobileOpen, setMobileOpen, desktopExpanded, setDesktopExpanded } =
    useDashboardSidebar();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setLogoutDialogOpen(false);
      setMobileOpen(false);
      navigate("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <aside
        onMouseEnter={() => !isMobile && setDesktopExpanded(true)}
        onMouseLeave={() => !isMobile && setDesktopExpanded(false)}
        className={cn(
          brandColors.sidebar.layout,
          "fixed inset-y-0 left-0 top-0 z-40",
          brandColors.sidebar.border,
          desktopExpanded ? brandColors.sidebar.widths.expanded : brandColors.sidebar.widths.collapsed,
          "hidden md:flex"
        )}
      >
        <SidebarBody
          expanded={desktopExpanded}
          onNavigate={handleNavigate}
          onLogout={() => setLogoutDialogOpen(true)}
        />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[88vw] border-r border-white/50 bg-white/82 p-0 text-slate-800 backdrop-blur-xl sm:max-w-xs"
        >
          <SheetTitle className="sr-only">MASID navigation</SheetTitle>
          <SidebarBody
            expanded
            onNavigate={handleNavigate}
            onLogout={() => setLogoutDialogOpen(true)}
          />
        </SheetContent>
      </Sheet>

      <ConfirmationDialog
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
