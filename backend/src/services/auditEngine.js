const { scrapePage, closeScrapeSession } = require('../audit/atoms/scraper');
const { runAccessibilityScan } = require('../audit/atoms/accessibilityScanner');
const { crawlSiteUrls } = require('../audit/atoms/siteCrawler');
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
const { runSemanticEvaluation } = require('./semanticEvaluator');

const { inspectPageSignals: inspectPageSignalsShared } = require('../audit/atoms/pageSignals');

class AuditError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AuditError';
    this.statusCode = statusCode;
  }
}

function validateTargetUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new AuditError('A valid url is required.', 400);
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new AuditError('Invalid URL format.', 400);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AuditError('URL must start with http:// or https://', 400);
  }

  return parsed;
}

function parseCrawlOptions(options = {}) {
  const requestedMaxPages = Number(options.maxPages);
  const boundedMaxPages = Number.isFinite(requestedMaxPages)
    ? Math.max(5, Math.min(10, requestedMaxPages))
    : 10;

  return {
    maxPages: boundedMaxPages,
    maxDepth: Number(options.maxDepth) >= 0 ? Number(options.maxDepth) : 3,
    concurrency: Number(options.concurrency) > 0 ? Number(options.concurrency) : 3,
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
  let pointer = 0;

  async function runner() {
    while (pointer < items.length) {
      const index = pointer;
      pointer += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const size = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: size }, () => runner()));
  return results;
}

function violationCount(axeResults, ids) {
  const violations = axeResults?.violations || [];
  let count = 0;
  for (const violation of violations) {
    if (ids.includes(violation.id)) {
      count += Array.isArray(violation.nodes) ? violation.nodes.length : 0;
    }
  }
  return count;
}

async function inspectPageSignals(page, targetOrigin) {
  // Single source of truth for page signals.
  // Why: eliminate drift/duplication between auditEngine.js and gwtChecker.js.
  return inspectPageSignalsShared(page, targetOrigin);
}

async function auditOnePage(target, origin, homepageUrl) {
  let session;
  try {
    session = await scrapePage(target.url, { timeoutMs: 30000 });
    const [axeResults, nonDescriptiveLinkCount, signals] = await Promise.all([
      runAccessibilityScan(session.page),
      countNonDescriptiveLinks(session.page),
      inspectPageSignals(session.page, origin),
    ]);

    const imageAltCount = violationCount(axeResults, ['image-alt', 'input-image-alt', 'area-alt']);
    const colorContrastCount = violationCount(axeResults, ['color-contrast']);
    const formLabelCount = violationCount(axeResults, ['label', 'form-field-multiple-labels', 'aria-input-field-name']);

    const summary = [];
    if (imageAltCount > 0) summary.push(`Missing ALT-related issues: ${imageAltCount}`);
    if (colorContrastCount > 0) summary.push(`Color contrast issues: ${colorContrastCount}`);
    if (formLabelCount > 0) summary.push(`Form label issues: ${formLabelCount}`);
    if (nonDescriptiveLinkCount > 0) summary.push(`Non-descriptive links: ${nonDescriptiveLinkCount}`);

    return {
      url: target.url,
      finalUrl: session.finalUrl,
      depth: target.depth,
      loadTimeMs: session.loadTimeMs,
      pstFound: signals.pstFound,
      logoLinksHome: signals.logoLinksHome,
      transparencySealLinked: signals.transparencySealLinked,
      breadcrumbEnabled: signals.breadcrumbEnabled,
      hasAbout: signals.hasAbout,
      hasContact: signals.hasContact,
      govphTopMenu: signals.govphTopMenu,
      menuSignature: signals.menuSignature,
      citizensCharter: signals.citizensCharter,
      blockedByBotProtection: signals.blockedByBotProtection,
      blockReason: signals.blockReason,
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
      pstFound: false,
      logoLinksHome: false,
      transparencySealLinked: false,
      breadcrumbEnabled: false,
      hasAbout: false,
      hasContact: false,
      govphTopMenu: false,
      menuSignature: '',
      citizensCharter: false,
      blockedByBotProtection: false,
      blockReason: null,
      imageAltCount: 0,
      colorContrastCount: 0,
      formLabelCount: 0,
      nonDescriptiveLinkCount: 0,
      violationsSummary: ['Page scan failed'],
      error: error.message,
      isHomepage: target.url === homepageUrl,
    };
  } finally {
    await closeScrapeSession(session);
  }
}

function buildCoverageCheck(key, category, item, values, evaluator, onPass, onFail) {
  const passed = values.filter((value) => evaluator(value));
  const total = values.length;
  const passCount = passed.length;
  const status = total > 0 && passCount === total ? 'Pass' : 'Fail';
  const remarks = status === 'Pass' ? onPass(passCount, total) : onFail(passCount, total, values);

  return normalizeCheck({
    key,
    category,
    item,
    status,
    remarks,
  });
}

async function runAudit(targetUrl, options = {}) {
  const parsedUrl = validateTargetUrl(targetUrl);
  const crawlOptions = parseCrawlOptions(options);
  let semanticSession;
  let errorSession;

  try {
    const discovered = await crawlSiteUrls(parsedUrl.toString(), {
      maxPages: crawlOptions.maxPages,
      maxDepth: crawlOptions.maxDepth,
    });

    if (discovered.length === 0) {
      throw new AuditError('Crawler could not discover any pages to scan.', 422);
    }

    // Ensure we have at least 5 pages to validate PST/logo consistency.
    if (discovered.length < 5) {
      try {
        const homepageSession = await scrapePage(parsedUrl.toString(), { timeoutMs: 20000 });
        const anchors = await homepageSession.page.$$eval('a[href]', (els) => els.map((e) => e.getAttribute('href')));
        for (const raw of anchors) {
          if (discovered.length >= 5) break;
          try {
            const normalized = new URL(raw, parsedUrl.origin).toString();
            if (normalized.startsWith(parsedUrl.origin) && !discovered.find((d) => d.url === normalized)) {
              discovered.push({ url: normalized, depth: 1 });
            }
          } catch {
            // skip invalid
          }
        }
        await closeScrapeSession(homepageSession);
      } catch {
        // not fatal, continue with whatever discovered
      }
    }

    const pageAudits = await runWithConcurrency(
      discovered,
      crawlOptions.concurrency,
      (target) => auditOnePage(target, parsedUrl.origin, parsedUrl.toString())
    );

    const performanceTrials = [];
    for (let i = 0; i < 3; i += 1) {
      let trialSession;
      try {
        trialSession = await scrapePage(parsedUrl.toString(), { timeoutMs: 30000 });
        performanceTrials.push(trialSession.loadTimeMs);
      } catch {
        performanceTrials.push(null);
      } finally {
        await closeScrapeSession(trialSession);
      }
    }

    semanticSession = await scrapePage(parsedUrl.toString(), { timeoutMs: 30000 });
    const semanticChecks = await runSemanticEvaluation(semanticSession.page, parsedUrl.toString());
    const semanticMap = mapByKey(semanticChecks);

    // Run all comprehensive checks on homepage in parallel
    const [
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
      buildContentAccessibilityChecks(semanticSession.page),
      buildNavigationStructureChecks(semanticSession.page, parsedUrl.origin),
      buildBrandIdentityChecks(semanticSession.page),
      buildCompanyInfoChecks(semanticSession.page),
      buildContactInfoChecks(semanticSession.page),
      buildWebPresenceStageChecks(semanticSession.page),
      buildContentQualityChecks(semanticSession.page),
      buildBrowserCompatibilityChecks(semanticSession.page),
      buildAdvancedPresenceChecks(semanticSession.page),
      buildSecurityChecks(semanticSession.page, parsedUrl.toString()),
      buildParticipationToolsChecks(semanticSession.page),
      buildMissingNavigationChecks(semanticSession.page, parsedUrl.origin),
      buildMissingErrorHandlingChecks(semanticSession.page),
      buildMissingBrandIdentityChecks(semanticSession.page),
      buildMissingCompanyInfoChecks(semanticSession.page),
      buildMissingContentChecks(semanticSession.page),
      buildMissingParticipationChecks(semanticSession.page),
    ]);

    const normalized404Url = new URL('/random-404-test', parsedUrl.origin).toString();
    errorSession = await scrapePage(normalized404Url, { timeoutMs: 15000 });
    const errorPageTitle = await errorSession.page.title();
    const errorBodySnippet = await errorSession.page.locator('body').innerText().catch(() => '');
    const hasMastheadOn404 = await errorSession.page.locator('header, [role="banner"], .masthead').first().isVisible().catch(() => false);
    const hasFooterOn404 = await errorSession.page.locator('footer, [role="contentinfo"]').first().isVisible().catch(() => false);

    const sameOrigin404 = new URL(errorSession.finalUrl).origin === parsedUrl.origin;
    const errorHandlingCheck = buildCustom404Check(
      errorSession.statusCode,
      sameOrigin404,
      errorPageTitle,
      errorBodySnippet.slice(0, 500),
      hasMastheadOn404,
      hasFooterOn404
    );

    const homepageAudit = pageAudits.find((page) => page.isHomepage) || pageAudits[0];
    const internalPages = pageAudits.filter((page) => !page.isHomepage);
    const homepageBlocked = Boolean(homepageAudit?.blockedByBotProtection);
    const referenceSignature = homepageAudit?.menuSignature || '';

    const imageAltTotal = pageAudits.reduce((sum, page) => sum + page.imageAltCount, 0);
    const colorContrastTotal = pageAudits.reduce((sum, page) => sum + page.colorContrastCount, 0);
    const formLabelTotal = pageAudits.reduce((sum, page) => sum + page.formLabelCount, 0);
    const nonDescLinkTotal = pageAudits.reduce((sum, page) => sum + page.nonDescriptiveLinkCount, 0);

    const aggregatedChecks = [
      buildCoverageCheck(
        'a11y.image_alt',
        'Technical Accessibility',
        'Image alternative text checks (H.1, H.2, H.3)',
        pageAudits,
        (page) => page.imageAltCount === 0,
        (_pass, total) => `Passed on all ${total}/${total} crawled pages.`,
        (pass, total) => `Failed on ${total - pass} page(s): Found ${imageAltTotal} ALT-related issue(s) across site.`
      ),
      buildCoverageCheck(
        'a11y.color_contrast',
        'Technical Accessibility',
        'Color contrast checks (C.1, C.2)',
        pageAudits,
        (page) => page.colorContrastCount === 0,
        (_pass, total) => `Passed on all ${total}/${total} crawled pages.`,
        (pass, total) => `Failed on ${total - pass} page(s): Found ${colorContrastTotal} contrast issue(s) across site.`
      ),
      buildCoverageCheck(
        'a11y.form_labels',
        'Technical Accessibility',
        'Form inputs have associated labels (H.6)',
        pageAudits,
        (page) => page.formLabelCount === 0,
        (_pass, total) => `Passed on all ${total}/${total} crawled pages.`,
        (pass, total) => `Failed on ${total - pass} page(s): Found ${formLabelTotal} form-label issue(s) across site.`
      ),
      buildCoverageCheck(
        'a11y.descriptive_links',
        'Technical Accessibility',
        'Avoid non-descriptive links like "Click Here" (B.10)',
        pageAudits,
        (page) => page.nonDescriptiveLinkCount === 0,
        (_pass, total) => `Passed on all ${total}/${total} crawled pages.`,
        (pass, total) => `Failed on ${total - pass} page(s): Found ${nonDescLinkTotal} non-descriptive link(s).`
      ),
      (() => {
        if (homepageBlocked) {
          return normalizeCheck({
            key: 'presence.pst',
            category: 'Presence & Identity',
            item: 'PST element present in masthead',
            status: 'N/A',
            remarks: 'Bot protection/challenge page detected on homepage; PST cannot be verified automatically.',
          });
        }

        const total = pageAudits.length;
        const passCount = pageAudits.filter((p) => p.pstFound).length;
        const failedPages = pageAudits.filter((p) => !p.pstFound);
        let status = 'Fail';
        let remarks = '';

        if (passCount === total) {
          status = 'Pass';
          remarks = `PST found on 100% of pages (${total}/${total}).`;
        } else if (homepageAudit?.pstFound && failedPages.length > 0 && failedPages.every((p) => p.error || p.loadTimeMs == null)) {
          // PST present on homepage but sub-pages appear to have timed out / failed during inspection
          status = 'Pass';
          remarks = `PST detected on homepage; some sub-pages timed out during inspection. Missing on: ${failedPages
            .slice(0, 5)
            .map((p) => p.url)
            .join(', ')}${failedPages.length > 5 ? '...' : ''}`;
        } else {
          status = 'Fail';
          remarks = `PST found on ${passCount}/${total} pages. Missing on: ${failedPages
            .slice(0, 5)
            .map((p) => p.url)
            .join(', ')}${failedPages.length > 5 ? '...' : ''}`;
        }

        return normalizeCheck({
          key: 'presence.pst',
          category: 'Presence & Identity',
          item: 'PST element present in masthead',
          status,
          remarks,
        });
      })(),
      (homepageBlocked
        ? normalizeCheck({
          key: 'presence.logo_home',
          category: 'Presence & Identity',
          item: 'Logo is in masthead and links to homepage',
          status: 'N/A',
          remarks: 'Bot protection/challenge page detected on homepage; logo-home link cannot be verified automatically.',
        })
        : buildCoverageCheck(
          'presence.logo_home',
          'Presence & Identity',
          'Logo is in masthead and links to homepage',
          pageAudits,
          (page) => page.logoLinksHome,
          (_pass, total) => `Logo-home link valid on all pages (${total}/${total}).`,
          (pass, total, pages) => {
            const failed = pages.filter((page) => !page.logoLinksHome);
            const failedPages = failed.slice(0, 5).map((page) => page.url);

            if (homepageAudit?.logoLinksHome && failed.length > 0 && failed.every((p) => p.error || p.loadTimeMs == null)) {
              return `Detected on homepage; sub-page timeout encountered. Missing on: ${failedPages.join(', ')}${failed.length > 5 ? '...' : ''}`;
            }

            return `Logo-home link valid on ${pass}/${total} pages. Missing on: ${failedPages.join(', ')}${failed.length > 5 ? '...' : ''}`;
          }
        )
      ),
      normalizeCheck({
        key: 'presence.transparency_seal_link',
        category: 'Presence & Identity',
        item: 'Transparency Seal image exists and has a link',
        status: homepageAudit?.transparencySealLinked ? 'Pass' : 'Fail',
        remarks: homepageAudit?.transparencySealLinked
          ? 'Transparency Seal is linked on homepage.'
          : 'Transparency Seal is missing or unlinked on homepage.',
      }),
      (internalPages.length > 0
        ? buildCoverageCheck(
          'presence.breadcrumbs',
          'Presence & Identity',
          'Breadcrumb navigation is enabled',
          internalPages,
          (page) => page.breadcrumbEnabled,
          (_pass, total) => `Breadcrumbs detected on all required pages (${total}/${total}).`,
          (pass, total) => `Breadcrumbs detected on ${pass}/${total} required pages.`
        )
        : normalizeCheck({
          key: 'presence.breadcrumbs',
          category: 'Presence & Identity',
          item: 'Breadcrumb navigation is enabled',
          status: 'N/A',
          remarks: 'No internal page was crawled. Breadcrumb check requires at least one non-homepage URL.',
        })
      ),
      buildCoverageCheck(
        'presence.govph_link',
        'Presence & Identity',
        'GovPH link exists in top menu',
        pageAudits,
        (page) => page.govphTopMenu,
        (_pass, total) => `GovPH top-menu link detected on all pages (${total}/${total}).`,
        (pass, total) => `GovPH top-menu link detected on ${pass}/${total} pages.`
      ),
      (homepageBlocked
        ? normalizeCheck({
          key: 'navigation.about_link',
          category: 'Navigation',
          item: 'About Us link is easy to find at top',
          status: 'N/A',
          remarks: 'Bot protection/challenge page detected on homepage; About link cannot be verified automatically.',
        })
        : buildCoverageCheck(
          'navigation.about_link',
          'Navigation',
          'About Us link is easy to find at top',
          pageAudits,
          (page) => page.hasAbout,
          (_pass, total) => `About link found on all pages (${total}/${total}).`,
          (pass, total, pages) => {
            const failedPages = pages.filter((page) => !page.hasAbout).slice(0, 5).map((page) => page.url);
            return `About link found on ${pass}/${total} pages. Missing on: ${failedPages.join(', ')}${total - pass > 5 ? '...' : ''}`;
          }
        )
      ),
      (homepageBlocked
        ? normalizeCheck({
          key: 'navigation.contact_link',
          category: 'Navigation',
          item: 'Contact link is easy to find at top',
          status: 'N/A',
          remarks: 'Bot protection/challenge page detected on homepage; Contact link cannot be verified automatically.',
        })
        : buildCoverageCheck(
          'navigation.contact_link',
          'Navigation',
          'Contact link is easy to find at top',
          pageAudits,
          (page) => page.hasContact,
          (_pass, total) => `Contact link found on all pages (${total}/${total}).`,
          (pass, total, pages) => {
            const failedPages = pages.filter((page) => !page.hasContact).slice(0, 5).map((page) => page.url);
            return `Contact link found on ${pass}/${total} pages. Missing on: ${failedPages.join(', ')}${total - pass > 5 ? '...' : ''}`;
          }
        )
      ),
      buildCoverageCheck(
        'navigation.menu_consistency',
        'Navigation',
        'Menu scheme is consistent across crawled pages',
        pageAudits,
        (page) => page.menuSignature === referenceSignature,
        (_pass, total) => `Menu signature consistent across ${total}/${total} pages.`,
        (pass, total) => `Menu signature consistent on ${pass}/${total} pages.`
      ),
    ];

    const checks = [
      buildPerformanceCheckFromTrials(performanceTrials),
      ...aggregatedChecks,
      errorHandlingCheck,
      // Content accessibility and structure
      ...contentAccessChecks,
      ...navigationChecks,
      ...brandChecks,
      // Company and contact information
      ...companyInfoChecks,
      ...contactChecks,
      // Web presence and resources
      ...presenceStageChecks,
      ...advancedPresenceChecks,
      // Content quality and consistency
      ...contentQualityChecks,
      // Browser compatibility
      ...browserCompatChecks,
      // Security and privacy
      ...securityChecks,
      // Participation and engagement tools
      ...participationChecks,
      // Missing checks (15 previously unimplemented items)
      ...missingNavChecks,
      ...missingErrorChecks,
      ...missingBrandChecks,
      ...missingCompanyChecks,
      ...missingContentChecks,
      ...missingParticipationChecks,
      normalizeCheck({
        key: 'presence.citizens_charter',
        category: 'Presence & Identity',
        item: "Citizens' Charter is documented",
        status: homepageAudit?.citizensCharter ? 'Pass' : 'Fail',
        remarks: homepageAudit?.citizensCharter
          ? "Citizen's Charter link/button detected via heuristic text matching."
          : `Failed: No Citizen's Charter control found on ${homepageAudit?.url || parsedUrl.toString()}.`,
      }),
      // Semantic checks
      semanticMap.get('semantic.tagline_clear') || normalizeCheck({
        key: 'semantic.tagline_clear',
        category: 'Semantic Content',
        item: 'Tagline clearly states institution purpose',
        status: 'N/A',
        remarks: 'Semantic check unavailable.',
      }),
      semanticMap.get('semantic.whitespace_layout') || normalizeCheck({
        key: 'semantic.whitespace_layout',
        category: 'Semantic Content',
        item: 'Homepage is uncluttered with sufficient white space',
        status: 'N/A',
        remarks: 'Semantic check unavailable.',
      }),
      semanticMap.get('semantic.about_contact_top') || normalizeCheck({
        key: 'semantic.about_contact_top',
        category: 'Semantic Content',
        item: 'About Us and Contact Us are easy to find at top',
        status: 'N/A',
        remarks: 'Semantic check unavailable.',
      }),
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
    if (error?.message?.includes('Timeout')) {
      throw new AuditError('Audit timed out while loading the page.', 408);
    }

    if (error instanceof AuditError) {
      throw error;
    }

    throw new AuditError(`Audit failed: ${error.message}`, 500);
  } finally {
    await closeScrapeSession(semanticSession);
    await closeScrapeSession(errorSession);
  }
}

module.exports = {
  runAudit,
  validateTargetUrl,
  AuditError,
};
