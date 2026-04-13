/* eslint-disable no-console */
const { runAudit } = require('./src/services/auditEngine');
const { buildUiAuditSummary } = require('./src/services/reportGenerator');

async function runOne(url) {
  const startedAt = Date.now();
  console.log(`\n=== AUDIT START: ${url} ===`);
  const auditResults = await runAudit(url, { maxPages: 10, maxDepth: 2, concurrency: 2 });
  console.log(`[audit] pagesCrawled=${auditResults?.crawlSummary?.pagesCrawled} checks=${auditResults?.checks?.length}`);
  const ui = await buildUiAuditSummary(auditResults);
  console.log('[ui] webPresence', ui.webPresence);
  console.log('[ui] webUsability', ui.webUsability);
  console.log(`[audit] durationMs=${Date.now() - startedAt}`);

  const sample = (auditResults.checks || []).slice(0, 25).map((c) => ({ key: c.key, status: c.status }));
  console.log('[audit] sample checks (first 25):', sample);

  return { auditResults, ui };
}

async function main() {
  // Ensure debug logs are enabled for crawler + heuristics
  process.env.AUDIT_DEBUG = process.env.AUDIT_DEBUG || '1';

  const urls = process.argv.slice(2);
  const targets = urls.length ? urls : ['https://www.gov.ph', 'https://example.com'];

  for (const url of targets) {
    try {
      await runOne(url);
    } catch (e) {
      console.error(`\n=== AUDIT FAILED: ${url} ===`);
      console.error(e);
    }
  }
}

main();
