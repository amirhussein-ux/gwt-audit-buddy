const express = require('express');
const { runAudit, AuditError } = require('../services/auditEngine');
const {
  generateAuditReport,
  generateAuditReportPdf,
  buildUiAuditSummary,
} = require('../services/reportGenerator');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLimiter, downloadLimiter } = require('../middleware/rateLimiter');
const Agency = require('../models/Agency');
const AuditLog = require('../models/AuditLog');
const ComplianceScore = require('../models/ComplianceScore');

const router = express.Router();

// Audit configuration constants
const AUDIT_CONFIG = {
  STAGE_THRESHOLD: 50, // Minimum score to achieve a stage
  PAGINATION_DEFAULTS: { skip: 0, limit: 50 },
  HOSTNAME_REGEX: /[^a-z0-9.-]/gi,
};

// Error messages for audit routes
const AUDIT_ERRORS = {
  URL_REQUIRED: 'url is required.',
  INVALID_URL_FORMAT: 'Invalid URL format.',
  URL_PROTOCOL_INVALID: 'URL must start with http:// or https://',
  AUDIT_NOT_FOUND: 'Audit not found',
  AUDIT_RESULTS_UNAVAILABLE: 'Audit results not available',
  FAILED_FETCH_AUDITS: 'Failed to fetch audit list',
  FAILED_AUDIT_DETAILS: 'Failed to retrieve audit details',
  FAILED_GENERATE_EXCEL: 'Failed to generate Excel file',
  FAILED_GENERATE_PDF: 'Failed to generate PDF file',
  UNAUTHORIZED_ACCESS: 'You do not have permission to access this audit. Only admins and the audit creator can view it.',
};

/**
 * Check if user owns the audit or is an admin (IDOR prevention)
 * @param {Object} user - Authenticated user object
 * @param {Object} audit - Audit log object
 * @returns {boolean} True if user can access
 */
const canAccessAudit = (user, audit) => {
  if (!user || !audit) return false;
  // Admins can access all audits
  if (user.role === 'admin') return true;
  // Owner can access their own audits
  if (audit.auditedBy && audit.auditedBy.toString() === user._id.toString()) return true;
  return false;
};

/**
 * Extract hostname from URL string safely
 * @param {string} url - URL string
 * @returns {string} Cleaned hostname with underscores
 */
const getCleanHostname = (url) => {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(AUDIT_CONFIG.HOSTNAME_REGEX, '_');
  } catch {
    return 'unknown-site';
  }
};

/**
 * Get audit report filename
 * @param {string} url - Audit URL
 * @param {Date} createdAt - Audit creation date
 * @param {string} extension - File extension
 * @returns {string} Formatted filename
 */
const getAuditFilename = (url, createdAt, extension) => {
  const hostname = getCleanHostname(url);
  const date = new Date(createdAt).toISOString().split('T')[0];
  return `${hostname}_audit_${date}.${extension}`;
};

/**
 * Validate audit URL
 * @param {string} url - URL to validate
 * @returns {Object} Validation result
 */
const validateAuditUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: AUDIT_ERRORS.URL_REQUIRED };
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: AUDIT_ERRORS.URL_PROTOCOL_INVALID };
    }
    return { valid: true, parsed };
  } catch {
    return { valid: false, error: AUDIT_ERRORS.INVALID_URL_FORMAT };
  }
};

/**
 * Extract domain name from URL for auto-created agencies
 * @param {URL} parsedUrl - Parsed URL object
 * @returns {string} Human-readable domain name
 */
const extractDomainName = (parsedUrl) => {
  return parsedUrl.hostname
    .split('.')
    .slice(0, -1)
    .join(' ')
    .replace(/^www\./, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Derive current maturity stage from individual scores
 * @param {number} s1 - Stage 1 score
 * @param {number} s2 - Stage 2 score
 * @param {number} s3 - Stage 3 score
 * @param {number} s4 - Stage 4 score
 * @returns {number} Current stage (1-4)
 */
const deriveCurrentStage = (s1, s2, s3, s4) => {
  if (s4 >= AUDIT_CONFIG.STAGE_THRESHOLD) return 4;
  if (s3 >= AUDIT_CONFIG.STAGE_THRESHOLD) return 3;
  if (s2 >= AUDIT_CONFIG.STAGE_THRESHOLD) return 2;
  return 1;
};

/**
 * GET /audit
 * List audits: admins see all, other users see only their own audits
 * Query params: ?skip=0&limit=50&status=success
 * IDOR FIX: Filter list by user ownership
 * ABUSE PROTECTION: Rate limited to prevent DOS attacks and scraping
 */
router.get('/', authenticate, auditLimiter, async (req, res) => {
  try {
    const { skip = AUDIT_CONFIG.PAGINATION_DEFAULTS.skip, limit = AUDIT_CONFIG.PAGINATION_DEFAULTS.limit, status } = req.query;
    const query = {};

    // IDOR FIX: Non-admin users only see their own audits
    if (req.user.role !== 'admin') {
      query.auditedBy = req.user._id;
    }

    if (status) {
      query.status = status;
    }

    const audits = await AuditLog.find(query)
      .populate('agency', 'name acronym domainUrl region')
      .populate('auditedBy', 'email username role')
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    const total = await AuditLog.countDocuments(query);

    return res.status(200).json({
      audits,
      total,
      skip: parseInt(skip),
      limit: parseInt(limit),
      note: req.user.role === 'admin' ? 'Showing all audits (admin view)' : 'Showing your audits only',
    });
  } catch (error) {
    console.error('[Audit List] Error:', error.message);
    return res.status(500).json({
      error: AUDIT_ERRORS.FAILED_FETCH_AUDITS,
    });
  }
});

/**
 * POST /audit
 * Start a new audit (returns immediately, processes in background)
 * ABUSE PROTECTION: Rate limited to prevent DOS attacks and resource exhaustion
 */
router.post('/', authenticate, auditLimiter, async (req, res) => {
  const { url, maxPages, maxDepth, concurrency, agencyId } = req.body || {};
  const startTime = Date.now();

  // Validate URL
  const urlValidation = validateAuditUrl(url);
  if (!urlValidation.valid) {
    return res.status(400).json({ error: urlValidation.error });
  }
  const { parsed: parsedUrl } = urlValidation;

  try {
    // Determine or create agency
    let agency = null;
    let agencyWasCreated = false;

    if (agencyId) {
      agency = await Agency.findById(agencyId);
    } else {
      agency = await Agency.findOne({ domainUrl: parsedUrl.origin });

      if (!agency) {
        const domainName = extractDomainName(parsedUrl);
        console.log('[auditRoute] Creating new agency for domain', {
          domainUrl: parsedUrl.origin,
          extractedName: domainName,
        });

        agency = await Agency.create({
          name: domainName,
          domainUrl: parsedUrl.origin,
          agencyType: 'other',
          region: 'NCR',
          isActive: true,
          tags: ['auto-discovered'],
        });
        agencyWasCreated = true;
      }
    }

    // Create AuditLog with "in_progress" status IMMEDIATELY
    const auditLog = new AuditLog({
      agency: agency ? agency._id : null,
      auditUrl: parsedUrl.toString(),
      status: 'in_progress',
      auditedBy: req.user._id, // IDOR FIX: Track who created the audit
      pst: { found: false },
      transparencySeal: { found: false },
      accessibility: { altTextCoverage: 0, formLabels: 0 },
      performance: { loadTimeMs: 0, pagesCrawled: 0, brokenLinks: 0 },
      createdAt: new Date(),
    });

    const savedAuditLog = await auditLog.save();

    // RETURN IMMEDIATELY with audit ID
    res.status(202).json({
      auditLogId: savedAuditLog._id,
      status: 'in_progress',
      message: 'Audit started. Processing in background.',
      agency: agency
        ? {
            _id: agency._id,
            name: agency.name,
            domainUrl: agency.domainUrl,
            wasCreated: agencyWasCreated,
          }
        : null,
    });

    // PROCESS AUDIT IN BACKGROUND (do not await)
    console.log('[auditRoute] Triggering background audit process:', {
      auditLogId: savedAuditLog._id,
      url: parsedUrl.toString(),
    });

    processAuditBackground(savedAuditLog._id, parsedUrl.toString(), { maxPages, maxDepth, concurrency }, agency, startTime)
      .then(() => {
        console.log('[auditRoute] Background audit completed successfully');
      })
      .catch((error) => {
        console.error('[Background Audit] FAILED for audit', savedAuditLog._id);
        console.error('[Background Audit] Error details:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error && error.stack) {
          console.error('[Background Audit] Stack trace:', error.stack);
        }
        // Update audit log status to failed
        AuditLog.findByIdAndUpdate(savedAuditLog._id, { status: 'failed', error: error.message }, { returnDocument: 'after' }).catch(
          (err) => console.error('[Cleanup] Failed to update status:', err)
        );
      });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[MASID] Audit init error:', errorMessage);
    if (error instanceof AuditError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: `Server error: ${errorMessage}` });
  }
});

/**
 * Extract and calculate compliance score from UI report
 * @param {Object} uiReport - UI report object with web presence and usability scores
 * @returns {Object} Structured compliance score data
 */
const buildComplianceScoreData = (uiReport) => {
  const stage1 = uiReport?.webPresence?.stage1 || 0;
  const stage2 = uiReport?.webPresence?.stage2 || 0;
  const stage3 = uiReport?.webPresence?.stage3 || 0;
  const stage4 = uiReport?.webPresence?.stage4 || 0;
  const webPresenceAverage = (stage1 + stage2 + stage3 + stage4) / 4;

  const accessibilityScore = uiReport?.webUsability?.accessibility || 0;
  const identityScore = uiReport?.webUsability?.identity || 0;
  const navigationScore = uiReport?.webUsability?.navigation || 0;
  const contentScore = uiReport?.webUsability?.content || 0;
  const webUsabilityAverage = (accessibilityScore + identityScore + navigationScore + contentScore) / 4;

  const overallScore = (webPresenceAverage + webUsabilityAverage) / 2;

  return {
    webPresence: {
      stage1,
      stage2,
      stage3,
      stage4,
      currentStage: deriveCurrentStage(stage1, stage2, stage3, stage4),
      averageScore: webPresenceAverage,
    },
    webUsability: {
      accessibility: accessibilityScore,
      identity: identityScore,
      navigation: navigationScore,
      content: contentScore,
    },
    overallScore,
  };
};

/**
 * Build audit log update data from audit results
 * @param {Object} auditResults - Raw audit engine results
 * @param {Object} uiReport - Calculated UI report
 * @param {number} auditDurationMs - Audit duration in milliseconds
 * @returns {Object} Data to update audit log
 */
const buildAuditLogUpdateData = (auditResults, uiReport, auditDurationMs) => {
  return {
    status: 'success',
    pst: {
      found: auditResults.checks?.some((c) => c.key === 'presence.pst' && c.status === 'Pass') || false,
    },
    transparencySeal: {
      found: auditResults.checks?.some((c) => c.key === 'presence.transparency-seal' && c.status === 'Pass') || false,
    },
    accessibility: {
      altTextCoverage: auditResults.checks?.filter((c) => c.key === 'a11y.alt-text').length > 0 ? 75 : 0,
    },
    performance: {
      loadTimeMs: auditResults.loadTime || 0,
      pagesCrawled: auditResults.crawlSummary?.pagesCrawled || auditResults.crawledPages?.length || 1,
      brokenLinks: auditResults.checks?.filter((c) => c.status === 'Fail').length || 0,
    },
    auditResults,
    uiReport,
    crawledPages: (auditResults.pageAudits || auditResults.crawledPages || []).map((p) => ({
      url: p.url,
      status: p.status || 200,
      title: p.title || '',
    })),
    auditDurationMs,
    completedAt: new Date(),
  };
};

/**
 * Background processing function
 * Runs audit without blocking the response
 */
async function processAuditBackground(auditLogId, url, options, agency, startTime) {
  console.log('[Background] Starting audit for', { auditLogId, url });

  try {
    const auditResults = await runAudit(url, options);
    console.log('[Background] Audit completed', {
      checksCount: auditResults.checks?.length || 0,
      pagesAudited: auditResults.pageAudits?.length || 0,
      crawledCount: auditResults.crawledPages?.length || 0,
      crawlSummary: auditResults.crawlSummary,
    });

    if (!auditResults.checks || auditResults.checks.length === 0) {
      console.warn('[Background] WARNING: No checks generated from audit');
    }

    // Generate UI report
    const uiReport = await buildUiAuditSummary(auditResults);
    console.log('[Background] UI Report generated:', {
      webPresenceStage1: uiReport?.webPresence?.stage1,
      webPresenceStage2: uiReport?.webPresence?.stage2,
      webPresenceStage3: uiReport?.webPresence?.stage3,
      webPresenceStage4: uiReport?.webPresence?.stage4,
      webUsabilityAccessibility: uiReport?.webUsability?.accessibility,
    });

    // Build and store audit results
    const auditDurationMs = Date.now() - startTime;
    const updateData = buildAuditLogUpdateData(auditResults, uiReport, auditDurationMs);

    console.log('[Background] Storing audit results', {
      checksCount: updateData.auditResults?.checks?.length,
      pagesCount: updateData.crawledPages?.length,
    });

    const updatedAuditLog = await AuditLog.findByIdAndUpdate(auditLogId, updateData, { returnDocument: 'after' });

    console.log('[Background] Audit log updated successfully', {
      auditLogId: updatedAuditLog._id,
      checksStored: updatedAuditLog.auditResults?.checks?.length,
      pagesStored: updatedAuditLog.crawledPages?.length,
      status: updatedAuditLog.status,
    });

    // Save compliance score if agency exists
    if (agency) {
      const complianceData = buildComplianceScoreData(uiReport);
      const complianceScore = new ComplianceScore({
        agency: agency._id,
        webPresence: complianceData.webPresence,
        webUsability: complianceData.webUsability,
        overallScore: complianceData.overallScore,
        auditLog: auditLogId,
        auditedAt: new Date(),
      });

      await complianceScore.save();

      // Update agency's last audit date
      agency.lastAuditDate = new Date();
      await agency.save();
    }

    console.log('[Background] Audit completed for', { auditLogId, url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Background] Audit processing failed:', errorMessage);
    throw error;
  }
}

/**
 * GET /audit/:id
 * Retrieve specific audit log with all details
 */
router.get('/:id', authenticate, auditLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const auditLog = await AuditLog.findById(id)
      .populate('agency', 'name acronym domainUrl region')
      .populate('auditedBy', 'email username role')
      .lean();

    if (!auditLog) {
      return res.status(404).json({
        error: AUDIT_ERRORS.AUDIT_NOT_FOUND,
      });
    }

    // IDOR FIX: Check if user owns this audit or is admin
    if (!canAccessAudit(req.user, auditLog)) {
      return res.status(403).json({
        error: AUDIT_ERRORS.UNAUTHORIZED_ACCESS,
      });
    }

    console.log('[Audit Detail] Returning audit:', {
      auditLogId: id,
      hasChecks: !!auditLog.auditResults?.checks,
      checkCount: auditLog.auditResults?.checks?.length || 0,
      hasUiReport: !!auditLog.uiReport,
      status: auditLog.status,
      owner: auditLog.auditedBy?.email,
      accessor: req.user.email,
    });

    // Get associated compliance score
    const complianceScore = await ComplianceScore.findOne({ auditLog: id }).lean();

    // Prefer ComplianceScore from dedicated collection, fallback to uiReport
    const finalCompliance = complianceScore || (auditLog.uiReport ? buildComplianceScoreData(auditLog.uiReport) : null);

    return res.status(200).json({
      audit: auditLog,
      compliance: finalCompliance,
      uiReport: auditLog.uiReport || null,
    });
  } catch (error) {
    console.error('[Audit Detail] Error:', error.message);
    return res.status(500).json({
      error: AUDIT_ERRORS.FAILED_AUDIT_DETAILS,
    });
  }
});

/**
 * GET /audit/:id/download/excel
 * Download audit report as Excel file (regenerated on-demand)
 * IDOR FIX: Check ownership before allowing download
 * ABUSE PROTECTION: Rate limited to prevent automated scraping
 */
router.get('/:id/download/excel', authenticate, downloadLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const auditLog = await AuditLog.findById(id).lean();

    if (!auditLog) {
      return res.status(404).json({ error: AUDIT_ERRORS.AUDIT_NOT_FOUND });
    }

    // IDOR FIX: Check if user owns this audit or is admin
    if (!canAccessAudit(req.user, auditLog)) {
      return res.status(403).json({
        error: AUDIT_ERRORS.UNAUTHORIZED_ACCESS,
      });
    }

    if (!auditLog.auditResults) {
      return res.status(400).json({ error: AUDIT_ERRORS.AUDIT_RESULTS_UNAVAILABLE });
    }

    // Regenerate Excel report on-demand
    const excelBuffer = await generateAuditReport(auditLog.auditResults);
    const filename = getAuditFilename(auditLog.auditUrl, auditLog.createdAt, 'xlsx');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    console.log('[Audit Download] Excel downloaded:', { auditLogId: id, filename, size: excelBuffer.length, user: req.user.email });
    return res.send(excelBuffer);
  } catch (error) {
    console.error('[Audit Download Excel] Error:', error.message);
    return res.status(500).json({ error: AUDIT_ERRORS.FAILED_GENERATE_EXCEL });
  }
});

/**
 * GET /audit/:id/download/pdf
 * Download audit report as PDF file (regenerated on-demand)
 * IDOR FIX: Check ownership before allowing download
 * ABUSE PROTECTION: Rate limited to prevent automated scraping
 */
router.get('/:id/download/pdf', authenticate, downloadLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const auditLog = await AuditLog.findById(id).lean();

    if (!auditLog) {
      return res.status(404).json({ error: AUDIT_ERRORS.AUDIT_NOT_FOUND });
    }

    // IDOR FIX: Check if user owns this audit or is admin
    if (!canAccessAudit(req.user, auditLog)) {
      return res.status(403).json({
        error: AUDIT_ERRORS.UNAUTHORIZED_ACCESS,
      });
    }

    if (!auditLog.auditResults) {
      return res.status(400).json({ error: AUDIT_ERRORS.AUDIT_RESULTS_UNAVAILABLE });
    }

    // Regenerate PDF report on-demand
    const pdfBuffer = await generateAuditReportPdf(auditLog.auditResults);
    const filename = getAuditFilename(auditLog.auditUrl, auditLog.createdAt, 'pdf');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    console.log('[Audit Download] PDF downloaded:', { auditLogId: id, filename, size: pdfBuffer.length, user: req.user.email });
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('[Audit Download PDF] Error:', error.message);
    return res.status(500).json({ error: AUDIT_ERRORS.FAILED_GENERATE_PDF });
  }
});

module.exports = router;