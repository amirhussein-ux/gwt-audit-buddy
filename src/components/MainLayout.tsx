import { ReactNode } from 'react';
import Sidebar from './Sidebar';

interface MainLayoutProps {
  children: ReactNode;
}

// Constants
const MAIN_LAYOUT_CONFIG = {
  CONTAINER_CLASSES: 'flex',
  CONTENT_CLASSES: 'flex-1 min-h-screen bg-slate-50',
};

/**
 * MainLayout Component
 * 
 * Provides the main application layout with:
 * - Fixed sidebar for navigation
 * - Full-height responsive content area
 * - Consistent spacing and styling
 */
export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className={MAIN_LAYOUT_CONFIG.CONTAINER_CLASSES}>
      <Sidebar />
      <div className={MAIN_LAYOUT_CONFIG.CONTENT_CLASSES}>
        {children}
      </div>
    </div>
  );
}
