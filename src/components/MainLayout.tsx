import type { ReactNode } from "react";

import Header from "./Header";
import Sidebar from "./Sidebar";
import {
  DashboardSidebarProvider,
  useDashboardSidebar,
} from "@/contexts/DashboardSidebarContext";
import { brandColors } from "@/lib/brandColors";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <DashboardSidebarProvider>
      <MainLayoutShell>{children}</MainLayoutShell>
    </DashboardSidebarProvider>
  );
}

function MainLayoutShell({ children }: MainLayoutProps) {
  const { desktopExpanded } = useDashboardSidebar();

  return (
    <div className={cn("min-h-screen text-slate-800", brandColors.appShell.background)}>
      <Sidebar />
      <main
        className={cn(
          "h-screen overflow-y-auto transition-[margin] duration-200 ease-in-out",
          brandColors.appShell.content,
          desktopExpanded ? "md:ml-64" : "md:ml-20"
        )}
      >
        <Header />
        <div className="min-w-0">{children}</div>
      </main>
    </div>
  );
}
