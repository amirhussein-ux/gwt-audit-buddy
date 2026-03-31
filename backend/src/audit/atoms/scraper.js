const { chromium } = require('playwright');

async function scrapePage(targetUrl, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30000;
  const browser = await chromium.launch({ headless: true });
  // Use a realistic browser context to reduce bot-challenge false negatives.
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    timezoneId: 'Asia/Manila',
    viewport: { width: 1365, height: 768 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });
  const startedAt = Date.now();

  try {
    // Avoid `networkidle` as the primary gate: real-world gov sites often keep long-polling
    // connections open, causing false timeouts before the DOM is usable.
    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    // Mandatory short pause to allow dynamic masthead elements (PST clocks, seals) to render
    await page.waitForTimeout(3000);

    // CRITICAL: wait until meaningful DOM is present before audits/detection.
    // This reduces false negatives from scanning too early.
    try {
      await page.waitForFunction(() => {
        return document.querySelectorAll('a').length > 20;
      }, { timeout: 7000 });
    } catch {
      // Not fatal: some pages legitimately have fewer links.
    }

    // Short targeted wait for commonly injected GWT elements (best-effort; non-fatal)
    try {
      await page.waitForSelector(
        '#pst-container, .pst-time, [id*="pst" i], [class*="pst" i], img[alt*="transparency" i], img[title*="transparency" i]',
        { timeout: 3000 }
      );
    } catch {
      // Continue if they don't appear.
    }

    const loadTimeFromNavigation = await page.evaluate(() => {
      const navEntry = performance.getEntriesByType('navigation')[0];
      if (navEntry && Number.isFinite(navEntry.loadEventEnd)) {
        return navEntry.loadEventEnd;
      }
      const timing = performance.timing;
      if (timing && timing.loadEventEnd && timing.navigationStart) {
        return timing.loadEventEnd - timing.navigationStart;
      }
      return null;
    });

    const loadTimeMs = Number.isFinite(loadTimeFromNavigation) && loadTimeFromNavigation > 0
      ? Math.round(loadTimeFromNavigation)
      : Date.now() - startedAt;

    return {
      browser,
      context,
      page,
      statusCode: response ? response.status() : null,
      finalUrl: page.url(),
      loadTimeMs,
    };
  } catch (error) {
    await context.close();
    await browser.close();
    throw error;
  }
}

async function closeScrapeSession(session) {
  if (!session) {
    return;
  }

  if (session.context) {
    await session.context.close();
  }

  if (session.browser) {
    await session.browser.close();
  }
}

module.exports = {
  scrapePage,
  closeScrapeSession,
};
