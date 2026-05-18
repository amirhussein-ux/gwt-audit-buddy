import type { Notification } from '@/lib/validation/notificationSchemas';
import {
  NotificationSchema,
  RecentNotificationsResponseSchema,
  UnreadCountResponseSchema,
} from '@/lib/validation/notificationSchemas';

type ParseOk<T> = { ok: true; data: T };
type ParseErr = { ok: false; error: string; issues?: unknown };
export type ParseResult<T> = ParseOk<T> | ParseErr;

export type ParsedRecentNotifications = { notifications: Notification[] };
export type ParsedUnreadCount = { unreadCount: number };

const normalizeUnreadCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export const parseRecentNotifications = (
  payload: unknown
): ParseResult<ParsedRecentNotifications> => {
  const candidate =
    payload && typeof payload === 'object' && 'notifications' in payload
      ? payload
      : { notifications: payload };

  const parsed = RecentNotificationsResponseSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid notifications payload', issues: parsed.error.issues };
  }

  const notifications = Array.isArray(parsed.data.notifications) ? parsed.data.notifications : [];
  return { ok: true, data: { notifications } };
};

export const parseUnreadCount = (
  payload: unknown
): ParseResult<ParsedUnreadCount> => {
  const parsed = UnreadCountResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid unread count payload', issues: parsed.error.issues };
  }

  return { ok: true, data: { unreadCount: normalizeUnreadCount(parsed.data.unreadCount) } };
};

// Optional: validate a raw notifications list if backend ever returns an array directly.
export const parseNotificationsList = (payload: unknown): ParseResult<ParsedRecentNotifications> => {
  if (!Array.isArray(payload)) {
    return { ok: false, error: 'Notifications list must be an array' };
  }

  const parsed = payload.map((n) => NotificationSchema.safeParse(n));
  const invalid = parsed.find((r) => !r.success);
  if (invalid && !invalid.success) {
    return {
      ok: false,
      error: 'Invalid notification object',
      issues: invalid.error.issues,
    };
  }

  return {
    ok: true,
    data: { notifications: parsed.filter((r): r is { success: true; data: Notification } => r.success).map((r) => r.data) },
  };
};
