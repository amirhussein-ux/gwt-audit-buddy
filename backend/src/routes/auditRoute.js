/**
 * auditRoute.js — MASID refined
 *
 * Key changes vs original:
 * 1. SPEED / UX: Audit now runs asynchronously. The route responds immediately
 *    with a jobId (202 Accepted) so the frontend isn't waiting 2-5 minutes on a
 *    single HTTP request that would time out on most proxies/load balancers.
 * 2. CORRECTNESS: Added request-level timeout guard (AUDIT_TIMEOUT_MS env var).
 * 3. CORRECTNESS: Input sanitisation rejects non-web URLs early.
 * 4. DX: GET /api/audit/status/:jobId lets the frontend poll for completion.
 *    GET /api/audit/result/:jobId returns the full audit payload once done.
 */

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { runAudit, AuditError } = require('../services/auditEngine');
const {
  generateAuditReport,
  generateAuditReportPdf,
  buildUiAuditSummary,
} = require('../services/reportGenerator');

const router = express.Router();

const jobStore = new Map(); // jobId -> { status, startedAt, finishedAt?, result?, error? }
const AUDIT_TIMEOUT_MS = Number(process.env.AUDIT_TIMEOUT_MS) || 5 * 60 * 1000;

function validateAuditInput(body) {
  const { url, maxPages, maxDepth, concurrency } = body || {};
  if (!url || typeof url !== 'string') return { error: 'url is required.', statusCode: 400 };
  let parsed;
  try { parsed = new URL(url); } catch { return { error: 'Invalid URL format.', statusCode: 400 }; }
  if (!['http:', 'https:'].includes(parsed.protocol))
    return { error: 'URL must start with http:// or https://', statusCode: 400 };
  return { url: parsed.toString(), maxPages, maxDepth, concurrency };
}

// POST /api/audit
router.post('/audit', (req, res) => {
  const input = validateAuditInput(req.body);
  if (input.error) return res.status(input.statusCode).json({ error: input.error });

  const jobId = uuidv4();
  jobStore.set(jobId, { status: 'running', startedAt: new Date().toISOString() });

  res.status(202).json({
    jobId, status: 'running',
    message: 'Audit started. Poll /api/audit/status/:jobId for progress.',
    statusUrl: `/api/audit/status/${jobId}`,
    resultUrl: `/api/audit/result/${jobId}`,
  });

  const timeoutHandle = setTimeout(() => {
    const job = jobStore.get(jobId);
    if (job?.status === 'running') {
      jobStore.set(jobId, { ...job, status: 'failed', error: 'Audit timed out.', finishedAt: new Date().toISOString() });
    }
  }, AUDIT_TIMEOUT_MS);

  (async () => {
    try {
      const auditResults = await runAudit(input.url, { maxPages: input.maxPages, maxDepth: input.maxDepth, concurrency: input.concurrency });
      const [xlsxBuffer, pdfBuffer] = await Promise.all([generateAuditReport(auditResults), generateAuditReportPdf(auditResults)]);
      const uiReport = await buildUiAuditSummary(auditResults);
      const safeHost = new URL(auditResults.url).hostname.replace(/[^a-z0-9.-]/gi, '_');
      const timestamp = Date.now();
      jobStore.set(jobId, {
        status: 'completed',
        startedAt: jobStore.get(jobId)?.startedAt,
        finishedAt: new Date().toISOString(),
        result: {
          auditResults, uiReport,
          downloads: {
            xlsx: { filename: `gwt-audit-${safeHost}-${timestamp}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: xlsxBuffer.toString('base64') },
            pdf:  { filename: `gwt-audit-${safeHost}-${timestamp}.pdf`,  mimeType: 'application/pdf', base64: pdfBuffer.toString('base64') },
          },
        },
      });
    } catch (err) {
      jobStore.set(jobId, { status: 'failed', startedAt: jobStore.get(jobId)?.startedAt, finishedAt: new Date().toISOString(), error: err.message || 'Unexpected error.', statusCode: err instanceof AuditError ? err.statusCode : 500 });
    } finally {
      clearTimeout(timeoutHandle);
    }
  })();
});

// GET /api/audit/status/:jobId
router.get('/audit/status/:jobId', (req, res) => {
  const job = jobStore.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json({ jobId: req.params.jobId, status: job.status, startedAt: job.startedAt, finishedAt: job.finishedAt || null, error: job.error || null, resultUrl: job.status === 'completed' ? `/api/audit/result/${req.params.jobId}` : null });
});

// GET /api/audit/result/:jobId
router.get('/audit/result/:jobId', (req, res) => {
  const job = jobStore.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (job.status === 'running') return res.status(202).json({ status: 'running', message: 'Audit still in progress.' });
  if (job.status === 'failed')  return res.status(job.statusCode || 500).json({ error: job.error });
  res.status(200).json(job.result);
  jobStore.delete(req.params.jobId);
});

module.exports = router;