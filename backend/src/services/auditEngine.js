/**
 * auditEngine.js — MASID refined
 *
 * Key speed improvements vs original:
 * 1. SPEED: All per-page scrapes (auditOnePage) now share ONE browser context
 *    via createSharedContext(). Original launched a fresh Chromium per page — the
 *    biggest single cause of slow audits.
 * 2. SPEED: Performance trials run in parallel (Promise.all) instead of serially.
 *    3 serial launches × ~5s each = ~15s saved.
 * 3. SPEED: Semantic evaluation reuses the SAME page already open for homepage
 *    checks — no extra scrapePage() call.
 * 4. SPEED: 404 check reuses shared context instead of opening a new browser.
 * 5. CORRECTNESS: auditOnePage now accepts a pre-opened page from the shared
 *    context, keeping the signal-detection logic unchanged.
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
  buildBrandIdentityChecks,
  buildCompanyInfoChecks,
  buildContactInfoChecks,
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

// ─── Error class ────────────────────────────────────────────────────────────
class AuditError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AuditError';
    this.statusCode = statusCode;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function canonicalHostname(hostname) {
  return String(hostname || '').toLowerCase().replace(/^www\./, '');
}

function isSameSiteUrl(urlString, startOrigin) {
  try {
    const candidate = new URL(urlString);
    const start     = new URL(startOrigin);
    if (!['http:', 'https:'].includes(candidate.protocol)) return false;
    return canonicalHostname(candidate.hostname) === canonicalHostname(start.hostname);
  } catch { return false; }
}

function validateTargetUrl(url) {
  if (!url || typeof url !== 'string') throw new AuditError('A valid url is required.', 400);
  let parsed;
  try { parsed = new URL(url); } catch { throw new AuditError('Invalid URL format.', 400); }
  if (!['http:', 'https:'].includes(parsed.protocol))
    throw new AuditError('URL must start with http:// or https://', 400);
  return parsed;
}

function parseCrawlOptions(options = {}) {
  const requestedMaxPages = Number(options.maxPages);
  const boundedMaxPages   = Number.isFinite(requestedMaxPages)
    ? Math.max(5, Math.min(50, requestedMaxPages))
    : 20; // lowered default from 50 → 20 for faster typical audits

  return {
    maxPages:    boundedMaxPages,
    maxDepth:    Number(options.maxDepth) >= 0 ? Number(options.maxDepth) : 2, // lowered 3 → 2
    concurrency: Number(options.concurrency) > 0 ? Number(options.concurrency) : 3,
  };
}

function mapByKey(checks) {
  const map = new Map();
  for (const check of checks) map.set(check.key, check);
  return map;
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let pointer   = 0;
  async function runner() {
    while (pointer < items.length) {
      const index = pointer++;
      results[index] = await worker(items[index], index);
    }
  }
  const size = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: size }, () => runner()));
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
    const [axeResults, nonDescriptiveLinkCount, signals] = await Promise.all([
      runAccessibilityScan(page),
      countNonDescriptiveLinks(page),
      inspectPageSignalsShared(page, origin),
    ]);

    const imageAltCount     = violationCount(axeResults, ['image-alt', 'input-image-alt', 'area-alt']);
    const colorContrastCount = violationCount(axeResults, ['color-contrast']);
    const formLabelCount    = violationCount(axeResults, ['label', 'form-field-multiple-labels', 'aria-input-field-name']);

    const summary = [];
    if (imageAltCount > 0)      summary.push(`Missing ALT-related issues: ${imageAltCount}`);
    if (colorContrastCount > 0) summary.push(`Color contrast issues: ${colorContrastCount}`);
    if (formLabelCount > 0)     summary.push(`Form label issues: ${formLabelCount}`);
    if (nonDescriptiveLinkCount > 0) summary.push(`Non-descriptive links: ${nonDescriptiveLinkCount}`);

    return {
      url: target.url,
      finalUrl: page.url(),
      depth: target.depth,
      loadTimeMs: target.loadTimeMs ?? null,
      ...signals,
      imageAltCount,
      colorContrastCount,
      formLabelCount,
      nonDescriptiveLinkCount,
      violationsSummary: summary.length > 0 ? summary : ['No recorded violations'],
      isHomepage: target.url === homepageUrl,
    };
  } catch (error) {
    return {
      url: target.url,
      depth: target.depth,
      loadTimeMs: null,
      pstFound: false, logoLinksHome: false, transparencySealLinked: false,
      breadcrumbEnabled: false, hasAbout: false, hasContact: false,
      govphTopMenu: false, govphIsFirstTopMenu: false,
      standardFooterHasAgencyLinks: false, sitemapFound: false, sitemapXmlOnly: false,
      hasMandateMission: false, mandateMissionInAboutSection: false,
      menuSignature: '', citizensCharter: false,
      blockedByBotProtection: false, blockReason: null,
      imageAltCount: 0, colorContrastCount: 0, formLabelCount: 0, nonDescriptiveLinkCount: 0,
      violationsSummary: ['Page scan failed'],
      error: error.message,
      isHomepage: target.url === homepageUrl,
    };
  }
}

function buildCoverageCheck(key, category, item, values, evaluator, onPass, onFail) {
  const passed    = values.filter((v) => evaluator(v));
  const total     = values.length;
  const passCount = passed.length;
  const status    = total > 0 && passCount === total ? 'Pass' : 'Fail';
  const remarks   = status === 'Pass' ? onPass(passCount, total) : onFail(passCount, total, values);
  return normalizeCheck({ key, category, item, status, remarks });
}

// ─── Main audit orchestrator ─────────────────────────────────────────────────
async function runAudit(targetUrl, options = {}) {
  const parsedUrl     = validateTargetUrl(targetUrl);
  const crawlOptions  = parseCrawlOptions(options);

  // Shared context for ALL page-level scraping (one Chromium launch for the whole audit).
  const sharedCtx = await createSharedContext();

  try {
    // ── 1. Crawl ──────────────────────────────────────────────────────────
    const discovered = await crawlSiteUrls(parsedUrl.toString(), {
      maxPages:    crawlOptions.maxPages,
      maxDepth:    crawlOptions.maxDepth,
      concurrency: crawlOptions.concurrency,
    });

    if (discovered.length === 0) {
      throw new AuditError('Crawler could not discover any pages to scan.', 422);
    }

    // Pad to minimum 5 pages for reliable PST/logo consistency checks.
    if (discovered.length < 5) {
      try {
        const { page: hpPage } = await scrapePageWithContext(sharedCtx.context, parsedUrl.toString(), { timeoutMs: 18000 });
        const hrefs = await hpPage.$$eval('a[href]', (els) => els.map((e) => e.getAttribute('href')));
        await hpPage.close().catch(() => {});
        for (const raw of hrefs) {
          if (discovered.length >= 5) break;
          try {
            const norm = new URL(raw, parsedUrl.origin).toString();
            if (isSameSiteUrl(norm, parsedUrl.origin) && !discovered.find((d) => d.url === norm)) {
              discovered.push({ url: norm, depth: 1 });
            }
          } catch { /* skip */ }
        }
      } catch { /* not fatal */ }
    }

    // ── 2. Per-page audits (shared context, concurrent) ───────────────────
    const pageAudits = await runWithConcurrency(
      discovered,
      crawlOptions.concurrency,
      async (target) => {
        let scrapeResult;
        try {
          scrapeResult = await scrapePageWithContext(sharedCtx.context, target.url, { timeoutMs: 25000 });
          const auditResult = await auditOnePage(
            scrapeResult.page,
            { ...target, loadTimeMs: scrapeResult.loadTimeMs },
            parsedUrl.origin,
            parsedUrl.toString()
          );
          return auditResult;
        } catch (err) {
          return {
            url: target.url, depth: target.depth, loadTimeMs: null,
            pstFound: false, logoLinksHome: false, transparencySealLinked: false,
            breadcrumbEnabled: false, hasAbout: false, hasContact: false,
            govphTopMenu: false, govphIsFirstTopMenu: false,
            standardFooterHasAgencyLinks: false, sitemapFound: false, sitemapXmlOnly: false,
            hasMandateMission: false, mandateMissionInAboutSection: false,
            menuSignature: '', citizensCharter: false,
            blockedByBotProtection: false, blockReason: null,
            imageAltCount: 0, colorContrastCount: 0, formLabelCount: 0, nonDescriptiveLinkCount: 0,
            violationsSummary: ['Page scan failed'], error: err.message,
            isHomepage: target.url === parsedUrl.toString(),
          };
        } finally {
          if (scrapeResult?.page) await scrapeResult.page.close().catch(() => {});
        }
      }
    );

    // ── 3. Performance trials — now parallel instead of serial ───────────
    const performanceTrials = await Promise.all(
      Array.from({ length: 3 }, async () => {
        let r;
        try {
          r = await scrapePageWithContext(sharedCtx.context, parsedUrl.toString(), { timeoutMs: 28000 });
          return r.loadTimeMs;
        } catch { return null; }
        finally { if (r?.page) await r.page.close().catch(() => {}); }
      })
    );

    // ── 4. Homepage checks (semantic + all gwtChecker builders) ───────────
    // Open ONE homepage page and reuse it for semantic + all builder functions.
    let homepagePage;
    let homepageScrape;
    try {
      homepageScrape = await scrapePageWithContext(sharedCtx.context, parsedUrl.toString(), { timeoutMs: 25000 });
      homepagePage   = homepageScrape.page;
    } catch (err) {
      throw new AuditError(`Could not load homepage for deep checks: ${err.message}`, 422);
    }

    const [
      semanticChecks,
      contentAccessChecks,
      navigationChecks,
      brandChecks,
      companyInfoChecks,
      contactChecks,
      presenceStageChecks,
      contentQualityChecks,
      browserCompatChecks,
      advancedPresenceChecks,
      securityChecks,
      participationChecks,
      missingNavChecks,
      missingErrorChecks,
      missingBrandChecks,
      missingCompanyChecks,
      missingContentChecks,
      missingParticipationChecks,
    ] = await Promise.all([
      runSemanticEvaluation(homepagePage, parsedUrl.toString()),
      buildContentAccessibilityChecks(homepagePage),
      buildNavigationStructureChecks(homepagePage, parsedUrl.origin),
      buildBrandIdentityChecks(homepagePage),
      buildCompanyInfoChecks(homepagePage),
      buildContactInfoChecks(homepagePage),
      buildWebPresenceStageChecks(homepagePage),
      buildContentQualityChecks(homepagePage),
      buildBrowserCompatibilityChecks(homepagePage),
      buildAdvancedPresenceChecks(homepagePage),
      buildSecurityChecks(homepagePage, parsedUrl.toString()),
      buildParticipationToolsChecks(homepagePage),
      buildMissingNavigationChecks(homepagePage, parsedUrl.origin),
      buildMissingErrorHandlingChecks(homepagePage),
      buildMissingBrandIdentityChecks(homepagePage),
      buildMissingCompanyInfoChecks(homepagePage),
      buildMissingContentChecks(homepagePage),
      buildMissingParticipationChecks(homepagePage),
    ]);

    await homepagePage.close().catch(() => {});

    // ── 5. 404 check (reuse shared context) ───────────────────────────────
    const normalized404Url = new URL('/random-404-test-masid', parsedUrl.origin).toString();
    let errorPageTitle     = '';
    let errorBodySnippet   = '';
    let hasMastheadOn404   = false;
    let hasFooterOn404     = false;
    let errorStatusCode    = null;
    let sameOrigin404      = false;
    let errorPageFinalUrl  = normalized404Url;

    let errorScrape;
    try {
      errorScrape     = await scrapePageWithContext(sharedCtx.context, normalized404Url, { timeoutMs: 12000 });
      errorPageTitle  = await errorScrape.page.title().catch(() => '');
      errorBodySnippet = await errorScrape.page.locator('body').innerText().catch(() => '').then((t) => t.slice(0, 500));
      hasMastheadOn404 = await errorScrape.page.locator('header, [role="banner"], .masthead').first().isVisible().catch(() => false);
      hasFooterOn404   = await errorScrape.page.locator('footer, [role="contentinfo"]').first().isVisible().catch(() => false);
      errorStatusCode  = errorScrape.statusCode;
      errorPageFinalUrl = errorScrape.page.url();
      sameOrigin404    = new URL(errorPageFinalUrl).origin === parsedUrl.origin;
    } catch { /* best-effort */ }
    finally { if (errorScrape?.page) await errorScrape.page.close().catch(() => {}); }

    const errorHandlingCheck = buildCustom404Check(
      errorStatusCode, sameOrigin404, errorPageTitle, errorBodySnippet, hasMastheadOn404, hasFooterOn404
    );

    // ── 6. Assemble aggregated checks ─────────────────────────────────────
    const semanticMap    = mapByKey(semanticChecks);
    const homepageAudit  = pageAudits.find((p) => p.isHomepage) || pageAudits[0];
    const internalPages  = pageAudits.filter((p) => !p.isHomepage);
    const homepageBlocked = Boolean(homepageAudit?.blockedByBotProtection);
    const referenceSignature = homepageAudit?.menuSignature || '';

    const imageAltTotal      = pageAudits.reduce((s, p) => s + p.imageAltCount,      0);
    const colorContrastTotal = pageAudits.reduce((s, p) => s + p.colorContrastCount, 0);
    const formLabelTotal     = pageAudits.reduce((s, p) => s + p.formLabelCount,     0);
    const nonDescLinkTotal   = pageAudits.reduce((s, p) => s + p.nonDescriptiveLinkCount, 0);

    const naIfBlocked = (key, category, item, reason) =>
      normalizeCheck({ key, category, item, status: 'N/A', remarks: reason });

    const aggregatedChecks = [
      buildCoverageCheck('a11y.image_alt', 'Technical Accessibility', 'Image alternative text checks (H.1, H.2, H.3)', pageAudits,
        (p) => p.imageAltCount === 0,
        (_, t) => `Passed on all ${t}/${t} crawled pages.`,
        (pass, t) => `Failed on ${t - pass} page(s): Found ${imageAltTotal} ALT-related issue(s) across site.`),
      buildCoverageCheck('a11y.color_contrast', 'Technical Accessibility', 'Color contrast checks (C.1, C.2)', pageAudits,
        (p) => p.colorContrastCount === 0,
        (_, t) => `Passed on all ${t}/${t} crawled pages.`,
        (pass, t) => `Failed on ${t - pass} page(s): Found ${colorContrastTotal} contrast issue(s) across site.`),
      buildCoverageCheck('a11y.form_labels', 'Technical Accessibility', 'Form inputs have associated labels (H.6)', pageAudits,
        (p) => p.formLabelCount === 0,
        (_, t) => `Passed on all ${t}/${t} crawled pages.`,
        (pass, t) => `Failed on ${t - pass} page(s): Found ${formLabelTotal} form-label issue(s) across site.`),
      buildCoverageCheck('a11y.descriptive_links', 'Technical Accessibility', 'Avoid non-descriptive links like "Click Here" (B.10)', pageAudits,
        (p) => p.nonDescriptiveLinkCount === 0,
        (_, t) => `Passed on all ${t}/${t} crawled pages.`,
        (pass, t) => `Failed on ${t - pass} page(s): Found ${nonDescLinkTotal} non-descriptive link(s).`),

      // PST check
      (() => {
        if (homepageBlocked) return naIfBlocked('presence.pst', 'Presence & Identity', 'PST element present in masthead', 'Bot protection detected; PST cannot be verified.');
        const subPages = pageAudits.filter((p) => !p.isHomepage);
        const missingSubPages = subPages.filter((p) => !p.pstFound);
        const unverified = missingSubPages.filter((p) => p.error || p.loadTimeMs == null);
        if (!homepageAudit?.pstFound) return normalizeCheck({ key: 'presence.pst', category: 'Presence & Identity', item: 'PST element present in masthead', status: 'Fail', remarks: 'PST not detected on homepage.' });
        let remarks = subPages.length === 0
          ? `Pass: PST present on homepage (1/1 crawled page).`
          : missingSubPages.length > 0
            ? `Pass: PST present on home, but missing on ${missingSubPages.length} sub-page(s) (GWT requires PST on all pages).`
            : `Pass: PST present on homepage and all ${subPages.length} crawled sub-pages.`;
        if (unverified.length > 0) remarks += ` ${unverified.length} sub-page(s) unverifiable.`;
        return normalizeCheck({ key: 'presence.pst', category: 'Presence & Identity', item: 'PST element present in masthead', status: 'Pass', remarks });
      })(),

      // Logo → home
      homepageBlocked
        ? naIfBlocked('presence.logo_home', 'Presence & Identity', 'Logo is in masthead and links to homepage', 'Bot protection detected.')
        : buildCoverageCheck('presence.logo_home', 'Presence & Identity', 'Logo is in masthead and links to homepage', pageAudits,
            (p) => p.logoLinksHome,
            (_, t) => `Logo-home link valid on all pages (${t}/${t}).`,
            (pass, t, pages) => {
              const failed = pages.filter((p) => !p.logoLinksHome).slice(0, 5).map((p) => p.url);
              return `Logo-home link valid on ${pass}/${t} pages. Missing on: ${failed.join(', ')}`;
            }),

      normalizeCheck({
        key: 'presence.transparency_seal_link', category: 'Presence & Identity',
        item: 'Transparency Seal image exists and has a link',
        status: homepageAudit?.transparencySealLinked ? 'Pass' : 'Fail',
        remarks: homepageAudit?.transparencySealLinked ? 'Transparency Seal is linked on homepage.' : 'Transparency Seal missing or unlinked on homepage.',
      }),

      internalPages.length > 0
        ? buildCoverageCheck('presence.breadcrumbs', 'Presence & Identity', 'Breadcrumb navigation is enabled', internalPages,
            (p) => p.breadcrumbEnabled,
            (_, t) => `Breadcrumbs detected on all required pages (${t}/${t}).`,
            (pass, t) => `Breadcrumbs detected on ${pass}/${t} required pages.`)
        : naIfBlocked('presence.breadcrumbs', 'Presence & Identity', 'Breadcrumb navigation is enabled', 'No internal page crawled.'),

      buildCoverageCheck('presence.govph_link', 'Presence & Identity', 'GovPH link exists in top menu',
        [homepageAudit].filter(Boolean),
        (p) => p.govphTopMenu,
        () => homepageAudit?.govphIsFirstTopMenu ? 'Pass: GovPH link found as first top-menu element.' : 'Pass: GovPH link found (not first element).',
        () => 'GovPH link not detected in top menu on homepage.'),

      // About link
      homepageBlocked
        ? naIfBlocked('navigation.about_link', 'Navigation', 'About Us link is easy to find at top', 'Bot protection detected.')
        : buildCoverageCheck('navigation.about_link', 'Navigation', 'About Us link is easy to find at top', pageAudits,
            (p) => p.hasAbout,
            (_, t) => `About link found on all pages (${t}/${t}).`,
            (pass, t, pages) => `About link found on ${pass}/${t} pages. Missing on: ${pages.filter((p) => !p.hasAbout).slice(0, 5).map((p) => p.url).join(', ')}`),

      // Contact link
      homepageBlocked
        ? naIfBlocked('navigation.contact_link', 'Navigation', 'Contact link is easy to find at top', 'Bot protection detected.')
        : buildCoverageCheck('navigation.contact_link', 'Navigation', 'Contact link is easy to find at top', pageAudits,
            (p) => p.hasContact,
            (_, t) => `Contact link found on all pages (${t}/${t}).`,
            (pass, t, pages) => `Contact link found on ${pass}/${t} pages. Missing on: ${pages.filter((p) => !p.hasContact).slice(0, 5).map((p) => p.url).join(', ')}`),

      buildCoverageCheck('navigation.menu_consistency', 'Navigation', 'Menu scheme is consistent across crawled pages', pageAudits,
        (p) => p.menuSignature === referenceSignature,
        (_, t) => `Menu signature consistent across ${t}/${t} pages.`,
        (pass, t) => `Menu signature consistent on ${pass}/${t} pages.`),
    ];

    const checks = [
      buildPerformanceCheckFromTrials(performanceTrials),
      ...aggregatedChecks,
      errorHandlingCheck,
      ...contentAccessChecks, ...navigationChecks, ...brandChecks,
      ...companyInfoChecks, ...contactChecks, ...presenceStageChecks,
      ...advancedPresenceChecks, ...contentQualityChecks, ...browserCompatChecks,
      ...securityChecks, ...participationChecks,
      ...missingNavChecks, ...missingErrorChecks, ...missingBrandChecks,
      ...missingCompanyChecks, ...missingContentChecks, ...missingParticipationChecks,
      normalizeCheck({
        key: 'presence.citizens_charter', category: 'Presence & Identity',
        item: "Citizens' Charter is documented",
        status: homepageAudit?.citizensCharter ? 'Pass' : 'Fail',
        remarks: homepageAudit?.citizensCharter
          ? "Citizen's Charter link/button detected."
          : `No Citizen's Charter control found on ${homepageAudit?.url || parsedUrl.toString()}.`,
      }),
      semanticMap.get('semantic.tagline_clear') || naIfBlocked('semantic.tagline_clear', 'Semantic Content', 'Tagline clearly states institution purpose', 'Semantic check unavailable.'),
      semanticMap.get('semantic.whitespace_layout') || naIfBlocked('semantic.whitespace_layout', 'Semantic Content', 'Homepage is uncluttered with sufficient white space', 'Semantic check unavailable.'),
      semanticMap.get('semantic.about_contact_top') || naIfBlocked('semantic.about_contact_top', 'Semantic Content', 'About Us and Contact Us are easy to find at top', 'Semantic check unavailable.'),
    ];

    return {
      url: parsedUrl.toString(),
      finalUrl: homepageAudit?.finalUrl || parsedUrl.toString(),
      auditedAt: new Date().toISOString(),
      crawlSummary: {
        pagesCrawled: pageAudits.length,
        maxPages: crawlOptions.maxPages,
        maxDepth: crawlOptions.maxDepth,
        concurrency: crawlOptions.concurrency,
      },
      loadTimeTrialsMs: performanceTrials,
      checks,
      pageAudits,
      axeSummary: {
        violations: imageAltTotal + colorContrastTotal + formLabelTotal,
        passes: 0,
      },
    };
  } catch (error) {
    if (error?.message?.includes('Timeout')) throw new AuditError('Audit timed out.', 408);
    if (error instanceof AuditError) throw error;
    throw new AuditError(`Audit failed: ${error.message}`, 500);
  } finally {
    await sharedCtx.close().catch(() => {});
  }
}

module.exports = { runAudit, validateTargetUrl, AuditError };