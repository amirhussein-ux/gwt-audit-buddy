import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ViewportModalProps {
  children: ReactNode;
  className?: string;
}

export default function ViewportModal({
  children,
  className = 'fixed inset-0 z-50 flex min-h-screen w-screen items-center justify-center bg-black/80 p-4',
}: ViewportModalProps) {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className={className} role="dialog" aria-modal="true">
      {children}
    </div>,
    document.body
  );
}
