import { z } from 'zod';

export const NotificationTypeSchema = z.union([
  z.literal('audit_completed'),
  z.literal('audit_cancelled'),
  z.literal('audit_failed'),
  z.literal('audit_archived'),
  z.literal('audit_restored'),
]);

export const NotificationSchema = z.object({
  _id: z.string(),
  type: NotificationTypeSchema,
  title: z.string(),
  message: z.string().optional(),
  auditUrl: z.string().optional(),
  createdAt: z.string(),
  isRead: z.boolean(),
});

export const RecentNotificationsResponseSchema = z.object({
  notifications: z.array(NotificationSchema).optional(),
});

export const UnreadCountResponseSchema = z.object({
  unreadCount: z.union([z.number(), z.string()]).optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;
