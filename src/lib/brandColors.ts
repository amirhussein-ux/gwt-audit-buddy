export const brandColors = {
  appShell: {
    background:
      "bg-[linear-gradient(180deg,#f8f5ff_0%,#f4f7ff_46%,#fff8f4_100%)]",
    contentPadding: "px-4 sm:px-6 lg:px-8",
    sectionSpacing: "space-y-6",
    header:
      "border-b border-white/40 bg-white/72 backdrop-blur-md shadow-[0_10px_30px_rgba(148,163,184,0.10)]",
    content:
      "bg-[radial-gradient(circle_at_top_left,rgba(216,180,254,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(191,219,254,0.2),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(253,230,220,0.22),transparent_24%)]",
  },
  motion: {
    subtle: "duration-200 ease-in-out",
  },
  sidebar: {
    panel:
      "bg-white/60 backdrop-blur-xl shadow-[0_16px_50px_rgba(148,163,184,0.14)]",
    border: "border-white/40",
    widths: {
      collapsed: "w-20",
      expanded: "w-64",
    },
    sectionLabel: "px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400/90",
    layout:
      "flex h-screen flex-col overflow-hidden border-r transition-[width] duration-200 ease-in-out",
    active: {
      bg: "bg-gradient-to-r from-violet-100 via-fuchsia-50 to-sky-50",
      text: "text-blue-700",
      icon: "text-blue-600",
      shadow: "shadow-[0_10px_24px_rgba(129,140,248,0.14)]",
    },
    inactive: {
      text: "text-slate-500",
      icon: "text-blue-500/70",
    },
    hover: {
      bg: "hover:bg-white/70",
      text: "hover:text-slate-700",
      icon: "group-hover:text-slate-700",
      scale: "hover:scale-[1.01]",
    },
    itemBase:
      "group flex w-full items-center overflow-hidden rounded-xl transition-all duration-200 ease-in-out",
    itemFocus:
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 focus-visible:ring-offset-0",
    iconButton:
      "inline-flex items-center justify-center rounded-xl border border-white/60 bg-white/70 text-slate-500 transition-all duration-200 ease-in-out hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60",
    tooltip:
      "border border-slate-200/70 bg-slate-900 text-white shadow-xl",
  },
  surfaces: {
    primaryCard:
      "border border-white/50 bg-white/78 backdrop-blur-lg shadow-[0_22px_60px_rgba(148,163,184,0.14)]",
    subtleCard:
      "border border-white/45 bg-white/70 backdrop-blur-lg shadow-[0_14px_40px_rgba(148,163,184,0.10)]",
    dashboardCard:
      "rounded-[28px] border border-white/45 bg-white/72 backdrop-blur-lg shadow-[0_18px_45px_rgba(148,163,184,0.12)]",
    heroCard:
      "rounded-[30px] border border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.84)_0%,rgba(245,243,255,0.92)_48%,rgba(239,246,255,0.88)_100%)] backdrop-blur-xl shadow-[0_28px_80px_rgba(129,140,248,0.18)]",
    statCard:
      "rounded-[24px] border border-white/40 shadow-[0_12px_30px_rgba(148,163,184,0.10)]",
  },
} as const;
