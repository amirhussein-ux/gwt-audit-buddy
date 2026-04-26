import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, FileText, Clock, Archive, LogOut, Menu, X, UserCircle2, Settings } from 'lucide-react';
import ConfirmationDialog from './ConfirmationDialog';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setLogoutDialogOpen(false);
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', id: 'dashboard' },
    { icon: FileText, label: 'Results', path: '/results', id: 'results' },
    { icon: Clock, label: 'Audit Log', path: '/audit-log', id: 'audit-log' },
    { icon: UserCircle2, label: 'Profile', path: '/profile', id: 'profile' },
    { icon: Settings, label: 'Settings', path: '/settings', id: 'settings' },
    ...(user?.role === 'admin'
      ? [{ icon: Archive, label: 'Archive', path: '/archive', id: 'archive' }]
      : []),
  ];

  const isActive = (path: string) => {
    if (path === '/results') {
      // Results should be active for both /results and /audit/:id pages
      return location.pathname === '/results' || location.pathname.startsWith('/audit/');
    }
    return location.pathname === path;
  };

  return (
    <>
      {/* Toggle Button for Mobile */}
      <div className="lg:hidden fixed top-4 left-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-slate-900 hover:bg-slate-800 text-white"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Backdrop for Mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-lg z-20 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 flex flex-col`}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div>
            <h1 className="text-xl font-bold">MASID</h1>
            <p className="text-xs text-slate-400 mt-1">Monitoring & Audit Dashboard</p>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-slate-700">
          <p className="text-sm font-medium">{user?.fullName || user?.username}</p>
          <p className="text-xs text-slate-400">{user?.positionTitle || user?.email}</p>
          <p className="text-xs text-slate-400">{user?.role}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.path);
                setIsOpen(false); // Close sidebar on mobile after navigation
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-slate-700">
          <Button
            variant="ghost"
            onClick={handleLogoutClick}
            className="w-full justify-start text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Logout Confirmation Dialog */}
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
