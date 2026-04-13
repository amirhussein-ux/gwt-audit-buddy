const mongoose = require('mongoose');

/**
 * ComplianceScore Schema - Calculated maturity scores for agencies
 * Tracks progression through Web Presence stages and Accessibility levels
 * Based on DICT Web Governance Framework
 */
const complianceScoreSchema = new mongoose.Schema(
  {
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
      required: [true, 'Agency reference is required'],
      index: true,
    },

    /**
     * Web Presence Stages (DICT Framework)
     * Stage 1: Emerging - Basic web presence with static content
     * Stage 2: Enhanced - Transactional capability
     * Stage 3: Interactive - Citizens can participate (consultations, feedback)
     * Stage 4: Transformational - Full integration with government services
     */
    webPresence: {
      stage1: {
        type: Number,
        min: 0,
        max: 100,
        description: 'Stage 1 - Emerging Web Presence score',
      },
      stage2: {
        type: Number,
        min: 0,
        max: 100,
        description: 'Stage 2 - Enhanced Web Presence score',
      },
      stage3: {
        type: Number,
        min: 0,
        max: 100,
        description: 'Stage 3 - Interactive Web Presence score',
      },
      stage4: {
        type: Number,
        min: 0,
        max: 100,
        description: 'Stage 4 - Transformational Web Presence score',
      },
      currentStage: {
        type: Number,
        enum: [1, 2, 3, 4],
        description: 'Highest achieved maturity stage',
      },
      averageScore: {
        type: Number,
        min: 0,
        max: 100,
        description: 'Average of all stage scores',
      },
    },

    /**
     * Web Usability Metrics
     * Covers accessibility, identity/branding, navigation, and content quality
     */
    webUsability: {
      accessibility: {
        type: Number,
        min: 0,
        max: 100,
        description: 'Accessibility factor score',
      },
      identity: {
        type: Number,
        min: 0,
        max: 100,
        description: 'Identity/branding factor score',
      },
      navigation: {
        type: Number,
        min: 0,
        max: 100,
        description: 'Navigation factor score',
      },
      content: {
        type: Number,
        min: 0,
        max: 100,
        description: 'Content quality factor score',
      },
    },

    /**
     * Overall Compliance Index
     * Weighted average of Presence and Usability dimensions
     */
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      description: 'Composite score (50% presence, 50% usability)',
    },

    /**
     * Compliance Status categories
     */
    complianceStatus: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'critical'],
      description: 'Status based on overall score breakdowns',
    },

    /**
     * Critical indicators for alerts
     */
    criticalIssues: [
      {
        type: {
          type: String,
          enum: ['missing_pst', 'missing_transparency_seal', 'missing_charter', 'accessibility_failure'],
        },
        severity: {
          type: String,
          enum: ['critical', 'high', 'medium', 'low'],
        },
        description: String,
      },
    ],

    /**
     * Trend tracking
     */
    previousScore: {
      type: Number,
      description: 'Previous overall score for trend comparison',
    },
    trend: {
      type: String,
      enum: ['improving', 'stable', 'declining'],
      description: 'Direction of compliance trend',
     },
    trendPercentage: {
      type: Number,
      description: 'Percentage change from previous score',
    },

    /**
     * Audit source
     */
    auditLog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuditLog',
      description: 'Link to the audit that generated these scores',
    },

    /**
     * Audit context
     */
    auditedAt: {
      type: Date,
      required: true,
    },
    auditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    /**
     * Manual adjustments (for validated corrections)
     */
    adjustments: [
      {
        field: String,
        originalValue: Number,
        adjustedValue: Number,
        reason: String,
        adjustedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        adjustedAt: Date,
      },
    ],

    notes: {
      type: String,
      description: 'Auditor notes or observations',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Automatically calculate trend when saving
 */
complianceScoreSchema.pre('save', async function () {
  if (!this.isNew && this.previousScore !== undefined) {
    const change = this.overallScore - this.previousScore;
    this.trendPercentage = ((change / this.previousScore) * 100).toFixed(2);

    if (change > 5) {
      this.trend = 'improving';
    } else if (change < -5) {
      this.trend = 'declining';
    } else {
      this.trend = 'stable';
    }
  }

  // Determine compliance status based on overall score
  const score = this.overallScore;
  if (score >= 85) this.complianceStatus = 'excellent';
  else if (score >= 70) this.complianceStatus = 'good';
  else if (score >= 55) this.complianceStatus = 'fair';
  else if (score >= 40) this.complianceStatus = 'poor';
  else this.complianceStatus = 'critical';
});

/**
 * Indexes for efficient queries
 */
complianceScoreSchema.index({ agency: 1, auditedAt: -1 });
complianceScoreSchema.index({ overallScore: -1 }); // For leaderboard
complianceScoreSchema.index({ complianceStatus: 1 });
complianceScoreSchema.index({ 'criticalIssues.severity': 1 });
complianceScoreSchema.index({ auditedAt: -1 }); // For trends

module.exports = mongoose.model('ComplianceScore', complianceScoreSchema);
