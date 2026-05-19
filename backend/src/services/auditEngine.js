/**
 * auditEngine.js — MASID refined with enhanced logging and validation
 */

const {
  scrapePage,
  closeScrapeSession,
  createSharedContext,
  scrapePageWithContext,
} = require('../audit/atoms/scraper');
const { runAccessibilityScan }   = require('../audit/atoms/accessibilityScanner');
const { crawlSiteUrls }          = require('../audit/atoms/siteCrawler');
const {
  buildPerformanceCheckFromTrials,
  buildCustom404Check,
  countNonDescriptiveLinks,
  normalizeCheck,
  buildContentAccessibilityChecks,
  buildNavigationStructureChecks,
  buildTopNavigationChecks,
  buildBrandIdentityChecks,
  buildCompanyInfoChecks,
  buildContactInfoChecks,
  buildPresenceIdentityChecks,
  buildWebPresenceStageChecks,
  buildContentQualityChecks,
  buildBrowserCompatibilityChecks,
  buildAdvancedPresenceChecks,
  buildSecurityChecks,
  buildParticipationToolsChecks,
  buildMissingNavigationChecks,
  buildMissingErrorHandlingChecks,
  buildMissingBrandIdentityChecks,
  buildMissingCompanyInfoChecks,
  buildMissingContentChecks,
  buildMissingParticipationChecks,
} = require('../audit/molecules/gwtChecker');
const { runSemanticEvaluation }  = require('./semanticEvaluator');
const { inspectPageSignals: inspectPageSignalsShared } = require('../audit/atoms/pageSignals');

class AuditError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

function debugLog(message, details) {
  const timestamp = new Date().toISOString();
  if (details !== undefined) {
    console.log(`[${timestamp}] [AUDIT_ENGINE] ${message}:`, JSON.stringify(details, null, 2));
  } else {
    console.log(`[${timestamp}] [AUDIT_ENGINE] ${message}`);
  }
}

function canonicalHostname(hostname) {
  return String(hostname || '').toLowerCase().replace(/^www\./, '');
}

function isSameSiteUrl(urlString, startOrigin) {
  try {
    const candidate = new URL(urlString);
    const start = new URL(startOrigin);
    if (!['http:', 'https:'].includes(candidate.protocol)) return false;
    return canonicalHostname(candidate.hostname) === canonicalHostname(start.hostname);
  } catch {
    return false;
  }
}

function validateTargetUrl(url) {
  if (!url || typeof url !== 'string') throw new AuditError('Invalid target URL: empty or not a string', 400);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new AuditError(`Invalid target URL: "${url}" is not a valid URL`, 400);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AuditError(`Invalid target URL: "${url}" must use http or https`, 400);
  }
  return parsed;
}

function parseCrawlOptions(options = {}) {
  // Validate and bound maxPages (prevent DoS through resource exhaustion)
  const requestedMaxPages = Number(options.maxPages);
  const boundedMaxPages   = Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
    ? Math.max(5, Math.min(50, requestedMaxPages))
    : 20;

  // Validate and bound maxDepth (prevent infinite recursion)
  const requestedMaxDepth = Number(options.maxDepth);
  const boundedMaxDepth = Number.isFinite(requestedMaxDepth) && requestedMaxDepth >= 0
    ? Math.max(0, Math.min(3, requestedMaxDepth))
    : 2;

  // Validate and bound concurrency (prevent thread exhaustion)
  const requestedConcurrency = Number(options.concurrency);
  const boundedConcurrency = Number.isFinite(requestedConcurrency) && requestedConcurrency > 0
    ? Math.max(1, Math.min(10, requestedConcurrency))
    : 3;

  debugLog('Parsed crawl options with validation', {
    requestedMaxPages,
    boundedMaxPages,
    requestedMaxDepth,
    boundedMaxDepth,
    requestedConcurrency,
    boundedConcurrency,
  });

  return {
    maxPages:    boundedMaxPages,
    maxDepth:    boundedMaxDepth,
    concurrency: boundedConcurrency,
  };
}

function mapByKey(checks) {
  const map = new Map();
  for (const check of checks) {
    map.set(check.key, check);
  }
  return map;
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let pointer   = 0;

  debugLog('runWithConcurrency started', { itemCount: items.length, concurrencyLimit: limit });

  async function runner() {
    while (pointer < items.length) {
      const index = pointer++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        debugLog(`Worker failed at index ${index}`, { error: error.message });
        results[index] = undefined;
      }
    }
  }

  const size = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: size }, () => runner()));
  
  debugLog('runWithConcurrency finished', { 
    totalResults: results.length, 
    successCount: results.filter(r => r !== undefined).length,
    failureCount: results.filter(r => r === undefined).length
  });
  
  return results;
}

function violationCount(axeResults, ids) {
  return (axeResults?.violations || [])
    .filter((v) => ids.includes(v.id))
    .reduce((sum, v) => sum + (Array.isArray(v.nodes) ? v.nodes.length : 0), 0);
}

// ─── Per-page audit (uses a pre-opened Playwright page) ────────────────────
async function auditOnePage(page, target, origin, homepageUrl) {
  try {
    debugLog('Starting audit on page', { url: target });

    const checks = [];
    
    // Build accessibility checks with error handling and timeout
    try {
      debugLog('Starting accessibility scan', { url: target });
      const axePromise = runAccessibilityScan(page, {});
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Accessibility scan timeout after 20s')), 20000)
      );
      await Promise.race([axePromise, timeoutPromise]);
      debugLog('Accessibility scan completed', { url: target });
    } catch (e) {
      debugLog('Accessibility scan failed', { error: e.message });
    }
    
    const signals = await inspectPageSignalsShared(page, origin);
    debugLog('Page signals detected', { url: target, signals: JSON.stringify(signals) });

    // Build all available check categories with error handling
    const checkBuilders = [
      { name: 'contentAccessibility', builder: () => buildContentAccessibilityChecks(page) },
      { name: 'navigationStructure', builder: () => buildNavigationStructureChecks(page, origin) },
      { name: 'topNavigation', builder: () => buildTopNavigationChecks(page) },
      { name: 'brandIdentity', builder: () => buildBrandIdentityChecks(page) },
      { name: 'companyInfo', builder: () => buildCompanyInfoChecks(page) },
      { name: 'contactInfo', builder: () => buildContactInfoChecks(page) },
      { name: 'presenceIdentity', builder: () => buildPresenceIdentityChecks(page, origin) },
      { name: 'webPresenceStage', builder: () => buildWebPresenceStageChecks(page) },
      { name: 'contentQuality', builder: () => buildContentQualityChecks(page) },
      { name: 'browserCompatibility', builder: () => buildBrowserCompatibilityChecks(page) },
      { name: 'advancedPresence', builder: () => buildAdvancedPresenceChecks(page) },
      { name: 'security', builder: () => buildSecurityChecks(page, target) },
      { name: 'participationTools', builder: () => buildParticipationToolsChecks(page) },
      { name: 'missingNavigation', builder: () => buildMissingNavigationChecks(page, origin) },
      { name: 'missingErrorHandling', builder: () => buildMissingErrorHandlingChecks(page) },
      { name: 'missingBrandIdentity', builder: () => buildMissingBrandIdentityChecks(page) },
      { name: 'missingCompanyInfo', builder: () => buildMissingCompanyInfoChecks(page) },
      { name: 'missingContent', builder: () => buildMissingContentChecks(page) },
      { name: 'missingParticipation', builder: () => buildMissingParticipationChecks(page) },
    ];
    
    for (const checkBuilder of checkBuilders) {
      try {
        debugLog(`Check builder starting: ${checkBuilder.name}`, { url: target });
        
        // Add timeout to each builder (10 seconds max per builder)
        const builderPromise = checkBuilder.builder();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`${checkBuilder.name} timeout after 10s`)), 10000)
        );
        const builderChecks = await Promise.race([builderPromise, timeoutPromise]);
        
        checks.push(...(builderChecks || []));
        debugLog(`Check builder completed: ${checkBuilder.name}`, { count: builderChecks?.length });
      } catch (e) {
        debugLog(`Check builder failed: ${checkBuilder.name}`, { error: e.message });
        // Continue without failing
      }
    }

    debugLog('Audit checks generated', { url: target, checkCount: checks.length });

    return { target, checks, signals };
  } catch (error) {
    debugLog('Error in auditOnePage', { url: target, error: error.message });
    throw error;
  }
}

// ─── Check for custom 404 page ────────────────────────────────────────────
async function checkCustom404(context, notFoundUrl) {
  try {
    const page = await context.newPage();
    
    try {
      const response = await page.goto(notFoundUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // Check if we got a valid page (not a network error)
      const responseStatus = response?.status() || 0;
      const pageTitle = await page.title();
      const bodySnippet = await page.evaluate(() => document.body.innerText.substring(0, 200));
      
      // Check for masthead and footer elements
      const hasMasthead = await page.evaluate(() => {
        return Boolean(document.querySelector('header, [role="banner"], nav, .navbar, .masthead, .pst'));
      });

      const hasFooter = await page.evaluate(() => {
        return Boolean(document.querySelector('footer, [role="contentinfo"], .footer'));
      });

      // The 404 check URL is always on the same origin as the audit target
      const sameOrigin = true;
      
      debugLog('404 page analysis', { 
        status: responseStatus,
        title: pageTitle,
        hasMasthead,
        hasFooter,
        looks404: /404|not found|page not found/i.test(`${pageTitle} ${bodySnippet}`)
      });
      
      return buildCustom404Check(responseStatus, sameOrigin, pageTitle, bodySnippet, hasMasthead, hasFooter);
    } finally {
      await page.close();
    }
  } catch (error) {
    debugLog('Custom 404 check error', { error: error.message });
    // Return a fail check if something went wrong
    return buildCustom404Check(0, false, '', '', false, false);
  }
}

// ─── Collect performance trials ────────────────────────────────────────────
async function collectPerformanceTrials(context, targetUrl, trialsCount = 3) {
  const trials = [];
  
  for (let i = 0; i < trialsCount; i++) {
    try {
      debugLog(`Performance trial ${i + 1}/${trialsCount}`, { url: targetUrl });
      
      const page = await context.newPage();
      const startTime = Date.now();
      
      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        const loadTime = Date.now() - startTime;
        trials.push(loadTime);
        debugLog(`Trial ${i + 1} completed`, { loadTimeMs: loadTime });
      } finally {
        await page.close();
      }
    } catch (error) {
      debugLog(`Trial ${i + 1} failed`, { error: error.message });
      trials.push(NaN); // Record failed trial as NaN
    }
  }
  
  return trials;
}

// ─── Main audit orchestrator ─────────────────────────────────────────────────
async function runAudit(targetUrl, options = {}) {
  debugLog('runAudit started', { targetUrl, options });

  const validated = validateTargetUrl(targetUrl);
  const origin = validated.origin;
  const crawlOpts = parseCrawlOptions(options);

  const shared = await createSharedContext();

  try {
    // Step 1: Crawl site
    debugLog('Starting site crawl', { origin, maxPages: crawlOpts.maxPages });

    let crawledPages = [];
    try {
      crawledPages = await crawlSiteUrls(targetUrl, {
        ...crawlOpts,
        context: shared.context,
      });
    } catch (crawlError) {
      debugLog('Site crawl failed', { error: crawlError.message });
      // Try to return at least the homepage
      crawledPages = [{ url: targetUrl }];
    }

    debugLog('Site crawl completed', { 
      crawledCount: crawledPages.length,
      pages: crawledPages.map(p => p.url)
    });

    if (!crawledPages || crawledPages.length === 0) {
      debugLog('WARNING: Crawl returned no pages, using homepage', { url: targetUrl });
      crawledPages = [{ url: targetUrl }];
    }

    // Step 2: Audit each page
    debugLog('Starting per-page audits', { pageCount: crawledPages.length });

    const allChecks = [];
    const pageResults = [];

    for (const crawledPage of crawledPages) {
      try {
        const pageUrl = crawledPage.url;
        debugLog('Auditing page', { url: pageUrl });

        const page = await shared.context.newPage();
        try {
          await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
          
          // Wait for dynamic content and scripts to render (PST, logos, navigation, etc.)
          await page.waitForTimeout(1500);
          
          const audit = await auditOnePage(page, pageUrl, origin, targetUrl);
          
          if (audit && audit.checks) {
            allChecks.push(...audit.checks);
            pageResults.push({
              url: pageUrl,
              checks: audit.checks,
              signals: audit.signals,
            });
          }

          debugLog('Page audit completed', { url: pageUrl, checkCount: audit?.checks?.length || 0 });
        } finally {
          await page.close();
        }
      } catch (error) {
        debugLog('Failed to audit page', { url: crawledPage?.url, error: error.message });
        // Continue to next page even if this one fails
      }
    }

    debugLog('Per-page audits completed', { 
      pagesAudited: pageResults.length,
      totalChecks: allChecks.length
    });

    if (allChecks.length === 0) {
      debugLog('WARNING: No checks were generated', { pagesAudited: pageResults.length });
    }

    // Collect performance trials on homepage
    debugLog('Collecting performance trials', { url: targetUrl });
    const performanceTrials = await collectPerformanceTrials(shared.context, targetUrl, 3);
    const performanceCheck = buildPerformanceCheckFromTrials(performanceTrials);
    allChecks.unshift(performanceCheck); // Add performance check at the beginning

    debugLog('Performance trials collected', { trials: performanceTrials });

    // Check for custom 404 page
    debugLog('Checking for custom 404 page', { origin });
    const custom404Page = `${origin}/nonexistent-path-${Date.now()}.html`;
    const custom404Check = await checkCustom404(shared.context, custom404Page);
    allChecks.unshift(custom404Check);

    debugLog('Custom 404 check completed');

    return {
      url: targetUrl,
      auditUrl: targetUrl,
      checks: allChecks,
      pageAudits: pageResults,
      crawledPages,
      crawlSummary: {
        pagesCrawled: crawledPages.length,
      },
      performance: {
        pagesCrawled: crawledPages.length,
      },
      auditedAt: new Date().toISOString(),
    };
  } catch (error) {
    debugLog('Audit failed with error', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    await shared.close();
  }
}

module.exports = { runAudit, validateTargetUrl, AuditError };