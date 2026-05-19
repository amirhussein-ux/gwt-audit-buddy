const express = require('express');
const { authenticate } = require('../middleware/auth');
const { reportLimiter } = require('../middleware/rateLimiter');
const { reportUpload } = require('../middleware/multer');
const Report = require('../models/Report');
const { sendReportConfirmationEmail, sendAdminNotificationEmail } = require('../services/reportService');

const router = express.Router();

// Configuration
const REPORT_CONFIG = {
  MAX_FILE_SIZE_MB: 5,
  ALLOWED_MIME_TYPES: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
  ],
};

const ERROR_MESSAGES = {
  TITLE_REQUIRED: 'Title is required',
  DESCRIPTION_REQUIRED: 'Description is required',
  CATEGORY_INVALID: 'Invalid category. Must be: bug, feature_request, performance_issue, data_accuracy, or other',
  PRIORITY_INVALID: 'Invalid priority. Must be: high, medium, or low',
  FILE_TOO_LARGE: `File size exceeds ${REPORT_CONFIG.MAX_FILE_SIZE_MB}MB limit`,
  FILE_TYPE_NOT_ALLOWED: 'File type not allowed. Allowed types: PNG, JPEG, GIF, WebP, PDF',
  SUBMISSION_FAILED: 'Failed to submit report. Please try again.',
};

const CATEGORY_OPTIONS = ['bug', 'feature_request', 'performance_issue', 'data_accuracy', 'other'];
const PRIORITY_OPTIONS = ['high', 'medium', 'low'];

/**
 * Validate report input
 * @param {Object} body - Request body
 * @param {File} file - Optional file upload
 * @returns {Object} Validation result
 */
const validateReportInput = (body, file) => {
  const { title, description, category, priority } = body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return { valid: false, error: ERROR_MESSAGES.TITLE_REQUIRED };
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return { valid: false, error: ERROR_MESSAGES.DESCRIPTION_REQUIRED };
  }

  if (!category || !CATEGORY_OPTIONS.includes(category)) {
    return { valid: false, error: ERROR_MESSAGES.CATEGORY_INVALID };
  }

  if (!priority || !PRIORITY_OPTIONS.includes(priority)) {
    return { valid: false, error: ERROR_MESSAGES.PRIORITY_INVALID };
  }

  // Validate file if present
  if (file) {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > REPORT_CONFIG.MAX_FILE_SIZE_MB) {
      return { valid: false, error: ERROR_MESSAGES.FILE_TOO_LARGE };
    }

    if (!REPORT_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return { valid: false, error: ERROR_MESSAGES.FILE_TYPE_NOT_ALLOWED };
    }
  }

  return { valid: true };
};

/**
 * POST /reports
 * Submit a new problem report
 * Rate limited to prevent abuse
 */
router.post('/', authenticate, reportLimiter, reportUpload.single('file'), async (req, res) => {
  try {
    const { title, description, category, priority = 'medium', auditLogId } = req.body;

    // Parse file from multipart if present
    let attachment = null;
    if (req.file) {
      // File is automatically parsed by multer middleware
      attachment = {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        data: req.file.buffer,
        size: req.file.size,
      };
    }

    // Validate input
    const validation = validateReportInput(
      { title, description, category, priority },
      req.file
    );

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        code: 'INVALID_INPUT',
      });
    }

    // Create report document
    const report = new Report({
      user: req.user._id,
      email: req.user.email || 'unknown@example.com',
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      auditLog: auditLogId || null,
      attachment: attachment ? attachment : undefined,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
      status: 'new',
    });

    await report.save();

    // Prepare report data for emails
    const reportForEmail = {
      _id: report._id,
      title: report.title,
      description: report.description,
      category: report.category,
      priority: report.priority,
      email: report.email,
      userName: req.user.username || 'User',
      createdAt: report.createdAt,
      attachment: attachment ? { filename: attachment.filename, size: attachment.size } : null,
    };

    // Send emails (non-blocking - don't wait for them)
    Promise.all([
      sendReportConfirmationEmail(report.email, reportForEmail),
      sendAdminNotificationEmail(reportForEmail),
    ]).catch((error) => {
      console.error('[ReportRoute] Email sending failed (non-blocking):', error.message);
      // Don't fail the request if emails fail
    });

    return res.status(201).json({
      message: 'Report submitted successfully',
      reportId: report._id,
      note: 'A confirmation email has been sent to your inbox',
    });
  } catch (error) {
    console.error('[ReportRoute] Error creating report:', error.message);
    return res.status(500).json({
      error: ERROR_MESSAGES.SUBMISSION_FAILED,
      code: 'SUBMISSION_FAILED',
    });
  }
});

/**
 * GET /reports/categories
 * Get available report categories
 */
router.get('/categories', (req, res) => {
  const categories = [
    { value: 'bug', label: 'Bug Report', icon: '🐛' },
    { value: 'feature_request', label: 'Feature Request', icon: '💡' },
    { value: 'performance_issue', label: 'Performance Issue', icon: '⚡' },
    { value: 'data_accuracy', label: 'Data Accuracy Issue', icon: '📊' },
    { value: 'other', label: 'Other Feedback', icon: '💬' },
  ];

  return res.status(200).json({ categories });
});

module.exports = router;
