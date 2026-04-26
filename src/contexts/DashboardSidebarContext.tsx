import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { useIsMobile } from "@/hooks/use-mobile";

interface DashboardSidebarContextValue {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isMobile: boolean;
  desktopExpanded: boolean;
  setDesktopExpanded: (expanded: boolean) => void;
}

const DashboardSidebarContext = createContext<DashboardSidebarContextValue | undefined>(undefined);

export function DashboardSidebarProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) {
      setDesktopExpanded(false);
    }
  }, [isMobile]);

  const value = useMemo<DashboardSidebarContextValue>(
    () => ({
      mobileOpen,
      setMobileOpen,
      isMobile,
      desktopExpanded,
      setDesktopExpanded,
    }),
    [mobileOpen, isMobile, desktopExpanded]
  );

  return (
    <DashboardSidebarContext.Provider value={value}>
      {children}
    </DashboardSidebarContext.Provider>
  );
}

export function useDashboardSidebar() {
  const context = useContext(DashboardSidebarContext);

  if (!context) {
    throw new Error("useDashboardSidebar must be used within DashboardSidebarProvider");
  }

  return context;
}
