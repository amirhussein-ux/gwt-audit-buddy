import { useAuth } from '@/contexts/AuthContext';
import NotificationCenter from './NotificationCenter';

export default function Header() {
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 shadow-sm z-30">
      <div className="flex items-center justify-between h-full px-6 lg:px-8">
        {/* Left side - Branding */}
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900">MASID</h1>
          <p className="text-xs text-slate-500">Monitoring & Audit Dashboard</p>
        </div>

        {/* Center - Page Title (can be dynamic based on route) */}
        <div className="flex-1 text-center">
          <p className="text-sm font-medium text-slate-700">
            {user && `Welcome, ${user.fullName || user.username}`}
          </p>
        </div>

        {/* Right side - Notifications */}
        <div className="flex-1 flex justify-end items-center gap-4">
          <NotificationCenter />
        </div>
      </div>
    </header>
  );
}
