/**
 * scraper.js — MASID refined
 *
 * Key changes vs original:
 * 1. SPEED: Block images/fonts/media at context level (saves 40-60% load time on gov sites).
 * 2. SPEED: Remove redundant waitForSelector for PST/seal — that belongs in gwtHeuristics, not here.
 * 3. SPEED: Reduce fixed waitForTimeout from 3000ms → 1200ms (still enough for dynamic mastheads).
 * 4. SPEED: waitForFunction link-count guard timeout cut from 7000ms → 4000ms.
 * 5. CORRECTNESS: Expose a createSharedContext() factory so auditEngine can reuse one
 *    browser+context across all page scrapes instead of launching a new browser per page.
 */

const { chromium } = require('playwright');

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font']);
// Keep stylesheets — some sites collapse navigation without them,
// producing false negatives for logo/nav detection.

const BROWSER_CONTEXT_OPTIONS = {
  ignoreHTTPSErrors: true,
  locale: 'en-US',
  timezoneId: 'Asia/Manila',
  viewport: { width: 1366, height: 768 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

/**
 * Create a shared browser + context that can be reused across multiple
 * scrapePage() calls. Caller is responsible for calling close() when done.
 *
 * Usage:
 *   const shared = await createSharedContext();
 *   const session = await scrapePageWithContext(shared.context, url);
 *   ...
 *   await shared.close();
 */
async function createSharedContext() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-component-extensions-with-background-pages',
      '--disable-background-networking',
      '--disable-component-update',
      '--no-default-browser-check',
      '--disable-plugins',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-pings',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--no-proxy-server',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
  const context = await browser.newContext(BROWSER_CONTEXT_OPTIONS);

  await context.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  // Block heavy resources for ALL pages opened in this context.
  await context.route('**/*', (route) => {
    if (BLOCKED_RESOURCE_TYPES.has(route.request().resourceType())) {
      return route.abort();
    }
    return route.continue();
  });

  return {
    browser,
    context,
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}

/**
 * Scrape a single page using an externally-managed context.
 * Does NOT close the context — caller owns lifecycle.
 */
async function scrapePageWithContext(context, targetUrl, options = {}) {
  const timeoutMs = options.timeoutMs ?? 25000;
  const page = await context.newPage();
  const startedAt = Date.now();

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    // Reduced fixed pause — enough for dynamic mastheads (PST clocks) to render.
    await page.waitForTimeout(1200);

    // Guard: ensure DOM has links before we start auditing.
    try {
      await page.waitForFunction(() => document.querySelectorAll('a').length > 5, {
        timeout: 4000,
      });
    } catch {
      // Non-fatal: some pages legitimately have very few links.
    }

    const loadTimeFromNavigation = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav && Number.isFinite(nav.loadEventEnd) && nav.loadEventEnd > 0) return nav.loadEventEnd;
      const t = performance.timing;
      if (t?.loadEventEnd && t?.navigationStart) return t.loadEventEnd - t.navigationStart;
      return null;
    });

    const loadTimeMs =
      Number.isFinite(loadTimeFromNavigation) && loadTimeFromNavigation > 0
        ? Math.round(loadTimeFromNavigation)
        : Date.now() - startedAt;

    return {
      page,        // caller must close page when done
      statusCode: response ? response.status() : null,
      finalUrl: page.url(),
      loadTimeMs,
    };
  } catch (error) {
    await page.close().catch(() => {});
    throw error;
  }
}

/**
 * Original standalone API — kept for backward compatibility.
 * Opens its own browser + context, so it is slower but self-contained.
 * Prefer createSharedContext() + scrapePageWithContext() in auditEngine.
 */
async function scrapePage(targetUrl, options = {}) {
  const timeoutMs = options.timeoutMs ?? 25000;
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-component-extensions-with-background-pages',
      '--disable-background-networking',
      '--disable-component-update',
      '--no-default-browser-check',
      '--disable-plugins',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-pings',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--no-proxy-server',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
  const context = await browser.newContext(BROWSER_CONTEXT_OPTIONS);

  await context.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await context.route('**/*', (route) => {
    if (BLOCKED_RESOURCE_TYPES.has(route.request().resourceType())) return route.abort();
    return route.continue();
  });

  const page = await context.newPage();
  const startedAt = Date.now();

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    await page.waitForTimeout(1200);

    try {
      await page.waitForFunction(() => document.querySelectorAll('a').length > 5, {
        timeout: 4000,
      });
    } catch {
      // non-fatal
    }

    const loadTimeFromNavigation = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav && Number.isFinite(nav.loadEventEnd) && nav.loadEventEnd > 0) return nav.loadEventEnd;
      const t = performance.timing;
      if (t?.loadEventEnd && t?.navigationStart) return t.loadEventEnd - t.navigationStart;
      return null;
    });

    const loadTimeMs =
      Number.isFinite(loadTimeFromNavigation) && loadTimeFromNavigation > 0
        ? Math.round(loadTimeFromNavigation)
        : Date.now() - startedAt;

    return { browser, context, page, statusCode: response ? response.status() : null, finalUrl: page.url(), loadTimeMs };
  } catch (error) {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    throw error;
  }
}

async function closeScrapeSession(session) {
  if (!session) return;
  if (session.page) await session.page.close().catch(() => {});
  if (session.context) await session.context.close().catch(() => {});
  if (session.browser) await session.browser.close().catch(() => {});
}

module.exports = {
  scrapePage,
  closeScrapeSession,
  createSharedContext,
  scrapePageWithContext,
};
