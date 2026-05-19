const mongoose = require('mongoose');

/**
 * Report Schema - User-submitted problem reports
 * Tracks bugs, feature requests, performance issues, data accuracy problems
 */
const reportSchema = new mongoose.Schema(
  {
    /**
     * Reporter information
     */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      description: 'User who submitted the report',
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      description: 'Reporter email (denormalized for quick access)',
    },
    /**
     * Report classification
     */
    category: {
      type: String,
      enum: ['bug', 'feature_request', 'performance_issue', 'data_accuracy', 'other'],
      required: true,
      index: true,
      description: 'Type of problem being reported',
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      required: true,
      default: 'medium',
      description: 'Priority level as assessed by reporter',
    },
    /**
     * Report content
     */
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title must be 200 characters or fewer'],
      description: 'Brief summary of the problem',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [5000, 'Description must be 5000 characters or fewer'],
      description: 'Detailed explanation of the problem',
    },
    /**
     * Optional audit context
     */
    auditLog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuditLog',
      default: null,
      description: 'Related audit if report is about a specific audit',
    },
    /**
     * Attachment (base64 encoded file)
     */
    attachment: {
      filename: {
        type: String,
        description: 'Original filename of the attachment',
      },
      mimetype: {
        type: String,
        description: 'MIME type (e.g., image/png)',
      },
      data: {
        type: Buffer,
        description: 'File content as binary data',
      },
      size: {
        type: Number,
        description: 'File size in bytes',
      },
    },
    /**
     * Report metadata
     */
    userAgent: {
      type: String,
      description: 'Browser/client user agent for debugging',
    },
    ipAddress: {
      type: String,
      description: 'Reporter IP address (for abuse detection)',
    },
    /**
     * Status (for internal tracking, not visible to user)
     */
    status: {
      type: String,
      enum: ['new', 'acknowledged', 'in_progress', 'resolved', 'closed'],
      default: 'new',
      index: true,
      description: 'Internal status for admin tracking',
    },
    internalNotes: {
      type: String,
      description: 'Notes for internal team only',
    },
    resolvedAt: {
      type: Date,
      default: null,
      description: 'Timestamp when issue was resolved',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for efficient querying
 */
reportSchema.index({ user: 1, createdAt: -1 });
reportSchema.index({ category: 1, priority: 1 });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
