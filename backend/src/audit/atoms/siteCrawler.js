const { chromium } = require('playwright');

function normalizeUrl(rawUrl, origin) {
  try {
    const parsed = new URL(rawUrl, origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    parsed.hash = '';
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

async function crawlSiteUrls(startUrl, options = {}) {
  const maxPages = Number(options.maxPages) > 0 ? Number(options.maxPages) : 20;
  const maxDepth = Number(options.maxDepth) >= 0 ? Number(options.maxDepth) : 3;
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 20000;

  const origin = new URL(startUrl).origin;
  const normalizedStart = normalizeUrl(startUrl, origin);
  if (!normalizedStart) {
    return [];
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });

  const visited = new Set([normalizedStart]);
  const queue = [{ url: normalizedStart, depth: 0 }];
  const discovered = [];

  try {
    while (queue.length > 0 && discovered.length < maxPages) {
      const current = queue.shift();
      discovered.push(current);

      if (current.depth >= maxDepth) {
        continue;
      }

      const page = await context.newPage();
      try {
        await page.goto(current.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        const links = await page.$$eval('a[href]', (anchors) =>
          anchors.map((anchor) => anchor.getAttribute('href')).filter(Boolean)
        );

        for (const href of links) {
          const normalized = normalizeUrl(href, origin);
          if (!normalized) {
            continue;
          }

          if (!normalized.startsWith(origin)) {
            continue;
          }

          if (visited.has(normalized)) {
            continue;
          }

          visited.add(normalized);
          queue.push({ url: normalized, depth: current.depth + 1 });

          if (visited.size >= maxPages) {
            break;
          }
        }
      } catch {
        // Continue crawling other URLs even if one page fails.
      } finally {
        await page.close();
      }
    }

    return discovered;
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = {
  crawlSiteUrls,
};
