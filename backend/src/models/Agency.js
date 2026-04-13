const mongoose = require('mongoose');

/**
 * Agency Schema - Master list of government agencies (DICT target)
 * Supports Philippine government agencies and regional organizations
 */
const agencySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Agency name is required'],
      trim: true,
      description: 'Official agency name (e.g., "Bureau of Internal Revenue", "Department of Education")',
    },
    acronym: {
      type: String,
      uppercase: true,
      trim: true,
      description: 'Agency acronym (e.g., BIR, DepEd)',
    },
    domainUrl: {
      type: String,
      required: [true, 'Domain URL is required'],
      lowercase: true,
      trim: true,
      match: [/^(https?:\/\/)/, 'Domain URL must start with http:// or https://'],
      description: 'Main website URL for auditing',
    },
    agencyType: {
      type: String,
      enum: ['national_bureau', 'national_department', 'sub_agency', 'regional_office', 'local_government', 'other'],
      required: true,
      description: 'Classification of government agency',
    },
    region: {
      type: String,
      enum: [
        'NCR', // National Capital Region
        'CAR', // Cordillera Administrative Region
        'I', 'II', 'III', 'IV-A', 'IV-B', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
        'XIII', // CARAGA
        'BARMM', // Bangsamoro Autonomous Region in Muslim Mindanao
        'National', // National agencies not region-specific
      ],
      required: true,
      description: 'Philippine region where agency is based',
    },
    headEmail: {
      type: String,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email format'],
      description: 'Contact email of agency head',
    },
    headPhone: {
      type: String,
      description: 'Contact phone number',
    },
    notes: {
      type: String,
      description: 'Internal notes about the agency',
    },
    isActive: {
      type: Boolean,
      default: true,
      description: 'Whether agency is actively being audited',
    },
    lastAuditDate: {
      type: Date,
      default: null,
      description: 'Date of most recent audit',
    },
    tags: {
      type: [String],
      default: [],
      description: 'Categorization tags (e.g., "high-priority", "compliance-issue")',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Create compound index for faster agency lookups
 */
agencySchema.index({ domainUrl: 1 }, { unique: true }); // Prevent duplicate government site entries
agencySchema.index({ region: 1, agencyType: 1 });
agencySchema.index({ isActive: 1, lastAuditDate: -1 });

module.exports = mongoose.model('Agency', agencySchema);
