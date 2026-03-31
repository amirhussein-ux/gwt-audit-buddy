const express = require('express');
const { runAudit, AuditError } = require('../services/auditEngine');
const {
  generateAuditReport,
  generateAuditReportPdf,
  buildUiAuditSummary,
} = require('../services/reportGenerator');

const router = express.Router();

router.post('/audit', async (req, res) => {
  const { url, maxPages, maxDepth, concurrency } = req.body || {};

  try {
    const auditResults = await runAudit(url, { maxPages, maxDepth, concurrency });
    const [xlsxBuffer, pdfBuffer] = await Promise.all([
      generateAuditReport(auditResults),
      generateAuditReportPdf(auditResults),
    ]);

    const uiReport = await buildUiAuditSummary(auditResults);

    const safeHost = new URL(auditResults.url).hostname.replace(/[^a-z0-9.-]/gi, '_');
    const timestamp = Date.now();

    res.status(200).json({
      auditResults,
      uiReport,
      downloads: {
        xlsx: {
          filename: `gwt-audit-${safeHost}-${timestamp}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          base64: xlsxBuffer.toString('base64'),
        },
        pdf: {
          filename: `gwt-audit-${safeHost}-${timestamp}.pdf`,
          mimeType: 'application/pdf',
          base64: pdfBuffer.toString('base64'),
        },
      },
    });
  } catch (error) {
    if (error instanceof AuditError) {
      return res.status(error.statusCode).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: 'Unexpected server error while running audit.',
    });
  }
});

module.exports = router;
