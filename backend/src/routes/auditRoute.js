const express = require('express');
const { runAudit, AuditError } = require('../services/auditEngine');
const {
  generateAuditReport,
  generateAuditReportPdf,
  buildUiAuditSummary,
} = require('../services/reportGenerator');
const { authenticate } = require('../middleware/auth');
const Agency = require('../models/Agency');
const AuditLog = require('../models/AuditLog');
const ComplianceScore = require('../models/ComplianceScore');

const router = express.Router();

/**
 * GET /audit
 * List all audits (with pagination support)
 * Query params: ?skip=0&limit=50&status=success
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { skip = 0, limit = 50, status } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    const audits = await AuditLog.find(query)
      .populate('agency', 'name acronym domainUrl region')
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
    });
  } catch (error) {
    console.error('[Audit List] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch audit list',
    });
  }
});

/**
 * POST /audit
 * Start a new audit (returns immediately, processes in background)
 */
router.post('/', authenticate, async (req, res) => {
  const { url, maxPages, maxDepth, concurrency, agencyId } = req.body || {};
  const startTime = Date.now();

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required.' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format.' });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: 'URL must start with http:// or https://' });
  }

  try {
    // Determine agency
    let agency = null;
    let agencyWasCreated = false;

    if (agencyId) {
      agency = await Agency.findById(agencyId);
    } else {
      agency = await Agency.findOne({ domainUrl: parsedUrl.origin });

      if (!agency) {
        const domainName = parsedUrl.hostname
          .split('.')
          .slice(0, -1)
          .join(' ')
          .replace(/^www\./, '')
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

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
      agency: agency ? {
        _id: agency._id,
        name: agency.name,
        domainUrl: agency.domainUrl,
        wasCreated: agencyWasCreated,
      } : null,
    });

    // PROCESS AUDIT IN BACKGROUND (do not await)
    console.log('[auditRoute] Triggering background audit process:', { auditLogId: savedAuditLog._id, url: parsedUrl.toString() });
    
    processAuditBackground(
      savedAuditLog._id,
      parsedUrl.toString(),
      { maxPages, maxDepth, concurrency },
      agency,
      startTime
    ).then(() => {
      console.log('[auditRoute] Background audit completed successfully');
    }).catch((error) => {
      console.error('[Background Audit] FAILED for audit', savedAuditLog._id);
      console.error('[Background Audit] Error details:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('[Background Audit] Stack trace:', error.stack);
      }
      // Update audit log status to failed
      AuditLog.findByIdAndUpdate(
        savedAuditLog._id, 
        { status: 'failed', error: error.message },
        { returnDocument: 'after' }
      ).catch(
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
 * Background processing function
 * Runs audit without blocking the response
 */
async function processAuditBackground(auditLogId, url, options, agency, startTime) {
  console.log('[Background] ⭐ FUNCTION ENTERED:', { auditLogId, url });
  
  try {
    console.log('[Background] Starting audit for', { auditLogId, url });

    console.log('[Background] Calling runAudit...');
    const auditResults = await runAudit(url, options);
    console.log('[Background] runAudit returned');
    
    console.log('[Background] Audit completed', { 
      checksCount: auditResults.checks?.length || 0,
      pagesAudited: auditResults.pageAudits?.length || 0,
      crawledCount: auditResults.crawledPages?.length || 0,
      crawlSummary: auditResults.crawlSummary,
      pagesInUrl: auditResults.pageAudits?.map(p => p.url) // Log which pages were audited
    });

    if (!auditResults.checks || auditResults.checks.length === 0) {
      console.warn('[Background] WARNING: No checks generated from audit');
    }

    const [xlsxBuffer, pdfBuffer] = await Promise.all([
      generateAuditReport(auditResults),
      generateAuditReportPdf(auditResults),
    ]);

    const uiReport = await buildUiAuditSummary(auditResults);
    const safeHost = new URL(auditResults.url || auditResults.auditUrl).hostname.replace(/[^a-z0-9.-]/gi, '_');
    const timestamp = Date.now();
    const auditDurationMs = timestamp - startTime;

    console.log('[Background] Storing audit results', {
      checksCount: auditResults.checks?.length,
      pageAuditsCount: auditResults.pageAudits?.length,
      crawledPagesCount: auditResults.crawledPages?.length,
      crawlSummary: auditResults.crawlSummary
    });

    console.log('[Background] UI Report generated:', {
      webPresenceStage1: uiReport?.webPresence?.stage1,
      webPresenceStage2: uiReport?.webPresence?.stage2,
      webPresenceStage3: uiReport?.webPresence?.stage3,
      webPresenceStage4: uiReport?.webPresence?.stage4,
      webUsabilityAccessibility: uiReport?.webUsability?.accessibility,
      webUsabilityIdentity: uiReport?.webUsability?.identity,
      webUsabilityNavigation: uiReport?.webUsability?.navigation,
      webUsabilityContent: uiReport?.webUsability?.content,
    });

    // Update AuditLog with completed results
    const updateData = {
      status: 'success',
      pst: {
        found:
          auditResults.checks?.some((c) => c.key === 'presence.pst' && c.status === 'Pass') ||
          false,
      },
      transparencySeal: {
        found:
          auditResults.checks?.some(
            (c) => c.key === 'presence.transparency-seal' && c.status === 'Pass'
          ) || false,
      },
      accessibility: {
        altTextCoverage:
          auditResults.checks?.filter((c) => c.key === 'a11y.alt-text').length > 0 ? 75 : 0,
      },
      performance: {
        loadTimeMs: auditResults.loadTime || 0,
        pagesCrawled: auditResults.crawlSummary?.pagesCrawled || auditResults.crawledPages?.length || 1,
        brokenLinks: auditResults.checks?.filter((c) => c.status === 'Fail').length || 0,
      },
      auditResults, // Store full audit results including checks array
      uiReport, // STORE the calculated report with percentages and scores!
      crawledPages: (auditResults.pageAudits || auditResults.crawledPages || []).map((p) => ({
        url: p.url,
        status: p.status || 200,
        title: p.title || '',
      })),
      auditDurationMs,
      completedAt: new Date(),
    };

    console.log('[Background] Audit results prepared for storage:', {
      checksCount: updateData.auditResults?.checks?.length,
      pagesCount: updateData.crawledPages?.length,
    });

    const updatedAuditLog = await AuditLog.findByIdAndUpdate(
      auditLogId,
      updateData,
      { returnDocument: 'after' }
    );

    console.log('[Background] Audit log updated successfully', {
      auditLogId: updatedAuditLog._id,
      checksStored: updatedAuditLog.auditResults?.checks?.length,
      pagesStored: updatedAuditLog.crawledPages?.length,
      status: updatedAuditLog.status,
    });

    // Save compliance score if agency exists
    if (agency) {
      const deriveCurrentStage = (s1, s2, s3, s4) => {
        if (s4 >= 50) return 4;
        if (s3 >= 50) return 3;
        if (s2 >= 50) return 2;
        return 1;
      };

      // Extract Web Presence scores directly from uiReport
      const stage1 = uiReport?.webPresence?.stage1 || 0;
      const stage2 = uiReport?.webPresence?.stage2 || 0;
      const stage3 = uiReport?.webPresence?.stage3 || 0;
      const stage4 = uiReport?.webPresence?.stage4 || 0;
      const webPresenceAverage = (stage1 + stage2 + stage3 + stage4) / 4;

      // Extract Web Usability scores directly from uiReport
      const accessibilityScore = uiReport?.webUsability?.accessibility || 0;
      const identityScore = uiReport?.webUsability?.identity || 0;
      const navigationScore = uiReport?.webUsability?.navigation || 0;
      const contentScore = uiReport?.webUsability?.content || 0;
      const webUsabilityAverage = (accessibilityScore + identityScore + navigationScore + contentScore) / 4;

      // Overall score is weighted average of Presence and Usability (no WCAG dimension)
      const overallScore = (webPresenceAverage + webUsabilityAverage) / 2;

      const complianceScore = new ComplianceScore({
        agency: agency._id,
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
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const auditLog = await AuditLog.findById(id)
      .populate('agency', 'name acronym domainUrl region')
      .lean();

    if (!auditLog) {
      return res.status(404).json({
        error: 'Audit not found',
      });
    }

    // Log what we're returning for debugging
    console.log('[Audit Detail] Returning audit:', {
      auditLogId: id,
      hasChecks: !!auditLog.auditResults?.checks,
      checkCount: auditLog.auditResults?.checks?.length || 0,
      hasUiReport: !!auditLog.uiReport,
      hasComplianceInAudit: !!auditLog.compliance,
      status: auditLog.status,
    });

    // Get associated compliance score
    const complianceScore = await ComplianceScore.findOne({ auditLog: id }).lean();

    // If we have uiReport stored in audit, extract the scores for compliance object
    let complianceFromReport = null;
    if (auditLog.uiReport) {
      complianceFromReport = {
        webPresence: {
          stage1: auditLog.uiReport.webPresence?.stage1 || 0,
          stage2: auditLog.uiReport.webPresence?.stage2 || 0,
          stage3: auditLog.uiReport.webPresence?.stage3 || 0,
          stage4: auditLog.uiReport.webPresence?.stage4 || 0,
        },
        webUsability: {
          accessibility: auditLog.uiReport.webUsability?.accessibility || 0,
          identity: auditLog.uiReport.webUsability?.identity || 0,
          navigation: auditLog.uiReport.webUsability?.navigation || 0,
          content: auditLog.uiReport.webUsability?.content || 0,
        },
      };
    }

    // Prefer ComplianceScore from dedicated collection, fallback to calculated from uiReport
    const finalCompliance = complianceScore || complianceFromReport || null;

    return res.status(200).json({
      audit: auditLog,
      compliance: finalCompliance,
      uiReport: auditLog.uiReport || null, // Include full report for frontend
    });
  } catch (error) {
    console.error('[Audit Detail] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to retrieve audit details',
    });
  }
});

/**
 * GET /audit/:id/download/excel
 * Download audit report as Excel file (regenerated on-demand)
 */
router.get('/:id/download/excel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const auditLog = await AuditLog.findById(id).lean();

    if (!auditLog) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    if (!auditLog.auditResults) {
      return res.status(400).json({ error: 'Audit results not available' });
    }

    // Regenerate Excel report on-demand
    const excelBuffer = await generateAuditReport(auditLog.auditResults);
    
    // Set response headers for file download
    const hostname = new URL(auditLog.auditUrl).hostname;
    const date = new Date(auditLog.createdAt).toISOString().split('T')[0];
    const filename = `${hostname}_audit_${date}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    
    console.log('[Audit Download] Excel downloaded:', { auditLogId: id, filename, size: excelBuffer.length });
    return res.send(excelBuffer);
  } catch (error) {
    console.error('[Audit Download Excel] Error:', error.message);
    return res.status(500).json({ error: 'Failed to generate Excel file' });
  }
});

/**
 * GET /audit/:id/download/pdf
 * Download audit report as PDF file (regenerated on-demand)
 */
router.get('/:id/download/pdf', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const auditLog = await AuditLog.findById(id).lean();

    if (!auditLog) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    if (!auditLog.auditResults) {
      return res.status(400).json({ error: 'Audit results not available' });
    }

    // Regenerate PDF report on-demand
    const pdfBuffer = await generateAuditReportPdf(auditLog.auditResults);
    
    // Set response headers for file download
    const hostname = new URL(auditLog.auditUrl).hostname;
    const date = new Date(auditLog.createdAt).toISOString().split('T')[0];
    const filename = `${hostname}_audit_${date}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    console.log('[Audit Download] PDF downloaded:', { auditLogId: id, filename, size: pdfBuffer.length });
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('[Audit Download PDF] Error:', error.message);
    return res.status(500).json({ error: 'Failed to generate PDF file' });
  }
});

module.exports = router;