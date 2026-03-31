const { runAudit } = require('./src/services/auditEngine');

const PRIORITY_KEYS = new Set([
  'presence.pst',
  'presence.logo_home',
  'navigation.about_link',
  'navigation.contact_link',
]);

(async () => {
  const url = process.argv[2] || 'https://psa.gov.ph';

  try {
    const result = await runAudit(url, { maxPages: 5, maxDepth: 0, concurrency: 1 });
    const home = result.pageAudits?.find((p) => p.isHomepage) || result.pageAudits?.[0];

    console.log('url:', url);
    console.log('blocked:', Boolean(home?.blockedByBotProtection));
    console.log('blockReason:', home?.blockReason || '(none)');

    for (const check of result.checks.filter((c) => PRIORITY_KEYS.has(c.key))) {
      console.log(`${check.key}: ${check.status}`);
      if (check.remarks) {
        console.log(`  ${check.remarks}`);
      }
    }
  } catch (error) {
    console.error('❌ Smoke audit failed:', error?.message || error);
    process.exitCode = 1;
  }
})();
