import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface MainLayoutProps {
  children: ReactNode;
}

// Constants
const MAIN_LAYOUT_CONFIG = {
  CONTAINER_CLASSES: 'flex flex-col h-screen',
  CONTENT_WRAPPER_CLASSES: 'flex flex-1 overflow-hidden pt-16',
  CONTENT_CLASSES: 'flex-1 overflow-y-auto bg-slate-50',
};

/**
 * MainLayout Component
 * 
 * Provides the main application layout with:
 * - Fixed header with notifications
 * - Fixed sidebar for navigation
 * - Full-height responsive content area
 * - Consistent spacing and styling
 */
export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className={MAIN_LAYOUT_CONFIG.CONTAINER_CLASSES}>
      <Header />
      <div className={MAIN_LAYOUT_CONFIG.CONTENT_WRAPPER_CLASSES}>
        <Sidebar />
        <div className={MAIN_LAYOUT_CONFIG.CONTENT_CLASSES}>
          {children}
        </div>
      </div>
    </div>
  );
}
