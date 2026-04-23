const mongoose = require('mongoose');

/**
 * Notification Schema - Global notification system for audit events
 * Tracks audit completion, cancellation, failure, and archiving events
 */
const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['audit_completed', 'audit_cancelled', 'audit_failed', 'audit_archived', 'audit_restored'],
      required: true,
      index: true,
      description: 'Type of notification event',
    },

    /**
     * Related audit information
     */
    auditLog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuditLog',
      required: true,
      index: true,
      description: 'Reference to the audit that triggered this notification',
    },

    /**
     * User who performed the action
     */
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      description: 'User who initiated the audit or archive action',
    },

    /**
     * Notification title and message
     */
    title: {
      type: String,
      required: true,
      description: 'Notification title (e.g., "Audit Completed")',
    },

    message: {
      type: String,
      required: true,
      description: 'Detailed notification message',
    },

    /**
     * Audit details for quick reference
     */
    auditUrl: {
      type: String,
      description: 'URL that was audited',
    },

    auditStatus: {
      type: String,
      enum: ['success', 'partial', 'failed', 'cancelled'],
      description: 'Status of the audit (for completion/failure notifications)',
    },

    /**
     * Additional metadata
     */
    metadata: {
      agency: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agency',
        description: 'Associated agency (if applicable)',
      },
      archiveReason: {
        type: String,
        description: 'Reason for archiving (for archive notifications)',
      },
      checksCompleted: {
        type: Number,
        description: 'Number of checks completed (for completion notifications)',
      },
      loadTimeMs: {
        type: Number,
        description: 'Page load time in ms (for completion notifications)',
      },
    },

    /**
     * Read status tracking per user
     * Array of user IDs who have read this notification
     */
    readBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      description: 'Array of user IDs who have read this notification (for per-user tracking)',
    },

    /**
     * Legacy isRead field (deprecated - use readBy array instead)
     * Kept for backward compatibility
     */
    isRead: {
      type: Boolean,
      default: false,
      index: true,
      description: 'DEPRECATED: Use readBy array instead. Whether notification has been read by any user',
    },

    /**
     * Visibility scope
     */
    scope: {
      type: String,
      enum: ['all_users', 'admin_only', 'auditor_only'],
      default: 'all_users',
      description: 'Who should receive this notification',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for efficient queries
 */
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ auditLog: 1, type: 1 });
notificationSchema.index({ triggeredBy: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1, createdAt: -1 }); // For unread notifications
notificationSchema.index({ scope: 1, createdAt: -1 }); // For filtered notifications
notificationSchema.index({ createdAt: -1 }); // For recent notifications

module.exports = mongoose.model('Notification', notificationSchema);
