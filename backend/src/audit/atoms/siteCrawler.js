/**
 * siteCrawler.js — MASID refined
 *
 * Key changes vs original:
 * 1. SPEED: Reuse a single browser + context across the entire crawl instead of
 *    opening a new browser per page (original bug — it never did, but it opened
 *    one page per iteration serially). Now opens up to `concurrency` pages at once.
 * 2. SPEED: Block images/fonts/media at context level (same as scraper.js).
 * 3. SPEED: Skip crawling binary files (.pdf, .docx, .zip, images) — these were
 *    being queued and timing out in the original.
 * 4. CORRECTNESS: Skip URLs that are clearly non-HTML (download links).
 * 5. CORRECTNESS: Smarter deduplication — treats http vs https of the same path
 *    as the same URL so we don't crawl the same page twice.
 */

const { chromium } = require('playwright');

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font']);

// File extensions that are never worth navigating to for DOM inspection.
const SKIP_EXTENSIONS = new Set([
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.zip', '.rar', '.gz', '.tar',
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
  '.mp4', '.mp3', '.avi', '.mov',
  '.css', '.js',
]);

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

function normalizeUrl(rawUrl, origin) {
  try {
    const parsed = new URL(rawUrl, origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;

    // Skip non-HTML resources.
    const ext = parsed.pathname.slice(parsed.pathname.lastIndexOf('.')).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) return null;

    parsed.hash = '';
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    // Normalize http → https for dedup purposes only (store as-is but key by https).
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Deduplication key: ignore protocol so http/https variants aren't crawled twice. */
function dedupKey(urlString) {
  try {
    const u = new URL(urlString);
    return `${canonicalHostname(u.hostname)}${u.pathname}${u.search}`;
  } catch {
    return urlString;
  }
}

/**
 * Fetch links from a page. Returns normalized same-site URLs.
 */
async function extractLinks(page, origin) {
  const hrefs = await page
    .$$eval('a[href]', (anchors) => anchors.map((a) => a.getAttribute('href')).filter(Boolean))
    .catch(() => []);

  const result = [];
  for (const href of hrefs) {
    const normalized = normalizeUrl(href, origin);
    if (normalized && isSameSiteUrl(normalized, origin)) {
      result.push(normalized);
    }
  }
  return result;
}

/**
 * Crawl a site and return an array of { url, depth } objects.
 *
 * @param {string} startUrl
 * @param {{ maxPages?: number, maxDepth?: number, timeoutMs?: number, concurrency?: number }} options
 */
async function crawlSiteUrls(startUrl, options = {}) {
  const maxPages   = Number(options.maxPages)   > 0 ? Number(options.maxPages)   : 20;
  const maxDepth   = Number(options.maxDepth)  >= 0 ? Number(options.maxDepth)   : 3;
  const timeoutMs  = Number(options.timeoutMs)  > 0 ? Number(options.timeoutMs)  : 18000;
  const concurrency = Math.min(Number(options.concurrency) > 0 ? Number(options.concurrency) : 3, 5);

  const parsedStart = new URL(startUrl);
  const origin = parsedStart.origin;
  const normalizedStart = normalizeUrl(startUrl, origin);
  if (!normalizedStart) return [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });

  // Block heavy resources for the entire crawl.
  await context.route('**/*', (route) => {
    if (BLOCKED_RESOURCE_TYPES.has(route.request().resourceType())) return route.abort();
    return route.continue();
  });

  const visitedKeys = new Set([dedupKey(normalizedStart)]);
  // BFS queue: { url, depth }
  const queue = [{ url: normalizedStart, depth: 0 }];
  const discovered = [];

  try {
    while (queue.length > 0 && discovered.length < maxPages) {
      // Drain up to `concurrency` items from the queue at once.
      const batch = [];
      while (queue.length > 0 && batch.length < concurrency && discovered.length + batch.length < maxPages) {
        batch.push(queue.shift());
      }
      if (batch.length === 0) break;

      // Visit all pages in this batch concurrently.
      const batchResults = await Promise.all(
        batch.map(async (item) => {
          const page = await context.newPage();
          try {
            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

            // Only extract child links if we haven't hit depth limit.
            const childLinks = item.depth < maxDepth ? await extractLinks(page, origin) : [];
            return { item, childLinks, error: null };
          } catch (err) {
            return { item, childLinks: [], error: err.message };
          } finally {
            await page.close().catch(() => {});
          }
        })
      );

      for (const { item, childLinks } of batchResults) {
        discovered.push(item);

        for (const href of childLinks) {
          const key = dedupKey(href);
          if (visitedKeys.has(key)) continue;
          if (visitedKeys.size >= maxPages * 2) break; // guard against huge sites
          visitedKeys.add(key);
          queue.push({ url: href, depth: item.depth + 1 });
        }
      }
    }

    return discovered;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

module.exports = { crawlSiteUrls };