import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, CheckCircle, AlertCircle, Archive, XCircle, Clock, Inbox } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ConfirmationDialog from './ConfirmationDialog';
import { CardSkeleton, EmptyState, ErrorState } from '@/components/states';
import type { Notification } from '@/lib/validation/notificationSchemas';
import { parseRecentNotifications, parseUnreadCount } from '@/lib/parsers/parseNotifications';

// Helper function for relative time formatting
const getRelativeTime = (date: string) => {
  const now = new Date();
  const notifTime = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - notifTime.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return notifTime.toLocaleDateString();
};

const NotificationCenter = () => {
  const { token, user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markAllConfirmationOpen, setMarkAllConfirmationOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const NOTIFICATION_CONFIG = {
    API: {
      BASE: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
      ENDPOINTS: {
        NOTIFICATIONS: '/notifications',
      },
    },
  };

  const {
    data: notificationsData,
    refetch: refetchNotifications,
    isLoading: isNotificationsLoading,
    error: notificationsError,
    isFetching: isNotificationsFetching,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await fetch(
        `${NOTIFICATION_CONFIG.API.BASE}${NOTIFICATION_CONFIG.API.ENDPOINTS.NOTIFICATIONS}/recent`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch notifications');

      const raw = await response.json().catch(() => ({}));
      const parsed = parseRecentNotifications(raw);
      if (!parsed.ok) throw new Error((parsed as { ok: false; error: string }).error);

      return parsed.data;
    },
    enabled: !!token && user?.settings?.notifications?.inAppEnabled !== false,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const {
    data: unreadData,
    refetch: refetchUnread,
    isLoading: isUnreadLoading,
    error: unreadError,
    isFetching: isUnreadFetching,
  } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      const response = await fetch(`${NOTIFICATION_CONFIG.API.BASE}/notifications/unread`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch unread count');

      const raw = await response.json().catch(() => ({}));
      const parsed = parseUnreadCount(raw);
      if (!parsed.ok) throw new Error((parsed as { ok: false; error: string }).error);

      return parsed.data;
    },
    enabled: !!token && user?.settings?.notifications?.inAppEnabled !== false,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  useEffect(() => {
    if (unreadData?.unreadCount !== undefined) {
      setUnreadCount(unreadData.unreadCount);
    }
  }, [unreadData]);

  useEffect(() => {
    if (!showDropdown) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowDropdown(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDropdown]);

  const notificationsQueryError = notificationsError || unreadError;
  const isNotificationsBusy = isNotificationsLoading || isUnreadLoading;
  const isRetryingNotifications = isNotificationsFetching || isUnreadFetching;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'audit_completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'audit_cancelled':
        return <XCircle className="h-4 w-4 text-yellow-600" />;
      case 'audit_failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'audit_archived':
        return <Archive className="h-4 w-4 text-blue-600" />;
      case 'audit_restored':
        return <CheckCircle className="h-4 w-4 text-purple-600" />;
      default:
        return <Bell className="h-4 w-4 text-slate-600" />;
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setActionError(null);
      const response = await fetch(
        `${NOTIFICATION_CONFIG.API.BASE}${NOTIFICATION_CONFIG.API.ENDPOINTS.NOTIFICATIONS}/${notificationId}/read`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to mark notification as read');

      refetchUnread();
      refetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      setActionError(error instanceof Error ? error.message : 'Failed to update the notification.');
    }
  };

  const handleMarkAllAsReadClick = () => {
    setMarkAllConfirmationOpen(true);
  };

  const handleMarkAllAsReadConfirm = async () => {
    setIsMarkingAll(true);
    try {
      setActionError(null);
      const response = await fetch(
        `${NOTIFICATION_CONFIG.API.BASE}${NOTIFICATION_CONFIG.API.ENDPOINTS.NOTIFICATIONS}/mark-all-read`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to mark all notifications as read');

      setMarkAllConfirmationOpen(false);
      refetchUnread();
      refetchNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      setActionError(error instanceof Error ? error.message : 'Failed to update notifications.');
      setMarkAllConfirmationOpen(false);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleRetryNotifications = async () => {
    setActionError(null);
    await Promise.all([refetchUnread(), refetchNotifications()]);
  };

  const notifications: Notification[] = notificationsData?.notifications ?? [];
  const displayedNotifications = showAll ? notifications : notifications.slice(0, 5);

  if (user?.settings?.notifications?.inAppEnabled === false) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative rounded-2xl border border-white/60 bg-white/70 p-2.5 text-slate-500 shadow-[0_10px_24px_rgba(148,163,184,0.08)] transition-all duration-200 hover:scale-[1.01] hover:bg-white hover:text-slate-700"
        title="Notifications"
        aria-haspopup="dialog"
        aria-expanded={showDropdown}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="default"
            className="absolute -top-2 -right-2 h-6 w-6 p-0 flex items-center justify-center text-xs font-bold bg-red-500 hover:bg-red-600 shadow-lg"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </button>

      {showDropdown && (
        <>
          {/* outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />

          <Card className="fixed right-6 top-24 z-50 w-96 overflow-hidden rounded-[28px] border border-white/60 bg-white/85 shadow-[0_24px_70px_rgba(148,163,184,0.18)] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-transparent p-0">
              <div className="flex items-center justify-between border-b border-slate-200/70 bg-[linear-gradient(135deg,rgba(245,243,255,0.86),rgba(239,246,255,0.72))] p-5">
                {showAll && (
                  <div className="px-5 py-2 border-b border-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-blue-600"
                      onClick={() => setShowAll(false)}
                    >
                      Show less
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Bell className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Notifications</h3>
                    <p className="text-xs text-slate-500">
                      {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                    </p>
                  </div>
                </div>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsReadClick}
                    className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium"
                  >
                    Mark all
                  </Button>
                )}
              </div>

              <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
                {actionError ? (
                  <div className="p-4">
                    <ErrorState
                      title="Notification update failed"
                      description={actionError}
                      compact
                      className="border-0 bg-transparent shadow-none"
                    />
                  </div>
                ) : null}

                {isNotificationsBusy ? (
                  <div className="p-4">
                    <CardSkeleton variant="list" rows={3} className="border-0 bg-transparent shadow-none" />
                  </div>
                ) : notificationsQueryError ? (
                  <div className="p-4">
                    <ErrorState
                      title="Notifications are unavailable"
                      description={
                        notificationsQueryError instanceof Error
                          ? notificationsQueryError.message
                          : 'Notifications could not be loaded right now.'
                      }
                      onRetry={() => void handleRetryNotifications()}
                      retryLabel={isRetryingNotifications ? 'Retrying...' : 'Retry'}
                      isRetrying={isRetryingNotifications}
                      compact
                      className="border-0 bg-transparent shadow-none"
                    />
                  </div>
                ) : displayedNotifications.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      title="No notifications yet"
                      description="New notifications will appear here."
                      icon={<Inbox className="h-6 w-6" />}
                      compact
                      className="border-0 bg-transparent shadow-none"
                    />
                  </div>
                ) : (
                  displayedNotifications.map((notification) => (
                    <div
                      key={notification._id}
                      className={`p-4 hover:bg-slate-50 transition-all duration-150 cursor-pointer border-l-4 ${
                        !notification.isRead ? 'border-l-blue-500 bg-blue-50/30' : 'border-l-transparent'
                      }`}
                      onClick={() => !notification.isRead && handleMarkAsRead(notification._id)}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-0.5 p-2 rounded-lg bg-white border border-slate-200">
                          {getNotificationIcon(notification.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900 leading-tight">
                                {notification.title}
                              </p>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                                {notification.message || notification.auditUrl}
                              </p>
                            </div>
                            {!notification.isRead && (
                              <div className="h-2.5 w-2.5 bg-blue-500 rounded-full flex-shrink-0 mt-1.5 animate-pulse shadow-sm" />
                            )}
                          </div>

                          <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                            <Clock className="h-3 w-3" />
                            {getRelativeTime(notification.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {displayedNotifications.length > 0 && (
                <div className="p-4 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium w-full"
                    onClick={() => setShowAll(true)}
                  >
                    {!showAll ? 'View all notifications →' : 'Showing all notifications'}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      <ConfirmationDialog
        isOpen={markAllConfirmationOpen}
        title="Mark all as read?"
        description="This will mark all your notifications as read. You can still view them in your notification history."
        confirmText="Mark All"
        cancelText="Cancel"
        variant="info"
        isLoading={isMarkingAll}
        onConfirm={handleMarkAllAsReadConfirm}
        onCancel={() => setMarkAllConfirmationOpen(false)}
      />
    </>
  );
};

export default NotificationCenter;
