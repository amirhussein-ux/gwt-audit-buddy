import * as React from "react";

/**
 * Mobile response hook configuration
 * Provides breakpoint constants for detecting mobile vs desktop viewports
 */
const MOBILE_CONFIG = {
  BREAKPOINT: 768, // px - width threshold for mobile detection
};

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_CONFIG.BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_CONFIG.BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_CONFIG.BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
