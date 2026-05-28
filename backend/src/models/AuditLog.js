const mongoose = require('mongoose');

/**
 * AuditLog Schema - Stores comprehensive results from Playwright audits
 * Includes PST compliance, transparency seals, accessibility, and Gemini semantic analysis
 */
const auditLogSchema = new mongoose.Schema(
  {
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
      required: false,
      index: true,
    },
    auditUrl: {
      type: String,
      required: [true, 'Audited URL is required'],
      description: 'The exact URL that was crawled',
    },
    status: {
      type: String,
      enum: ['in_progress', 'success', 'partial', 'failed', 'cancelled'],
      default: 'in_progress',
    },

    /**
     * PST (Philippine Standard Time) Compliance
     */
    pst: {
      found: {
        type: Boolean,
        default: false,
        description: 'Whether PST timestamp was detected on site',
      },
      location: {
        type: String,
        description: 'Where PST was found (e.g., footer, navbar)',
      },
      format: {
        type: String,
        description: 'Detected PST format',
      },
    },

    /**
     * Transparency Seal / Official Seal
     */
    transparencySeal: {
      found: {
        type: Boolean,
        default: false,
      },
      link: {
        type: String,
        description: 'URL of transparency seal image or link',
      },
      location: {
        type: String,
        description: 'Position on site (e.g., footer, sidebar)',
      },
    },

    /**
     * Citizens Charter
     */
    citizensCharter: {
      found: {
        type: Boolean,
        default: false,
      },
      link: {
        type: String,
      },
    },

    /**
     * Masthead Links (About Us, Contact Us, Home)
     */
    masthead: {
      aboutUs: { type: Boolean, default: false },
      contactUs: { type: Boolean, default: false },
      home: { type: Boolean, default: false },
    },

    /**
     * Web Accessibility Metrics
     */
    accessibility: {
      altTextCoverage: {
        type: Number,
        min: 0,
        max: 100,
        description: 'Percentage of images with alt text',
      },
      formLabels: {
        type: Number,
        min: 0,
        max: 100,
        description: 'Percentage of forms with proper labels',
      },
    },

    /**
     * Performance Metrics
     */
    performance: {
      loadTimeMs: {
        type: Number,
        description: 'Page load time in milliseconds',
      },
      pagesCrawled: {
        type: Number,
        description: 'Number of pages crawled in audit',
      },
      brokenLinks: {
        type: Number,
        default: 0,
      },
    },

    /**
     * Content Quality (from Gemini semantic analysis)
     */
    semanticAnalysis: {
      summary: {
        type: String,
        description: 'AI-generated summary of content quality and completeness',
      },
      keyTopics: [String],
      contentGaps: [String],
      recommendedImprovements: [String],
      overallQualityScore: {
        type: Number,
        min: 0,
        max: 100,
      },
    },

    /**
     * Raw audit data (all checks from auditEngine)
     */
    auditResults: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Complete audit data from auditEngine.js for detailed review',
    },

    /**
     * Error details for failed audits
     */
    error: {
      type: String,
      default: null,
      description: 'Failure reason captured when an audit cannot complete',
    },

    /**
     * UI Report (calculated summary with scores and percentages)
     */
    uiReport: {
      type: mongoose.Schema.Types.Mixed,
      description: 'Calculated UI report with Web Presence and Web Usability scores',
    },

    /**
     * URL mapping (which pages were crawled)
     */
    crawledPages: [
      {
        url: String,
        status: Number, // HTTP status
        title: String,
      },
    ],

    /**
     * Audit metadata
     */
    auditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      description: 'User who initiated the audit',
    },
    auditDurationMs: {
      type: Number,
      description: 'How long the audit took',
    },
    notes: {
      type: String,
      description: 'Manual notes about this audit',
    },

    /**
     * Audit cancellation lifecycle metadata
     */
    cancellation: {
      requestedAt: {
        type: Date,
        default: null,
      },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      completedAt: {
        type: Date,
        default: null,
      },
      message: {
        type: String,
        default: '',
      },
    },

    /**
     * Archive status and metadata
     */
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
      description: 'Whether this audit result has been archived',
    },
    archivedAt: {
      type: Date,
      default: null,
      description: 'Timestamp when audit was archived',
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      description: 'Admin who archived this audit',
    },
    archiveReason: {
      type: String,
      description: 'Optional reason for archiving',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes for efficient queries
 */
auditLogSchema.index({ agency: 1, createdAt: -1 });
auditLogSchema.index({ 'pst.found': 1 });
auditLogSchema.index({ 'transparencySeal.found': 1 });
// Indexes removed for WCAG fields
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ isArchived: 1, archivedAt: -1 }); // For archive queries
auditLogSchema.index({ auditedBy: 1, isArchived: 1 }); // For user audit queries
auditLogSchema.index({ 'cancellation.requestedAt': -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
