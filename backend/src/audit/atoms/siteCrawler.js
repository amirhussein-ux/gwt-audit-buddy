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

function shouldDebug() {
  return String(process.env.AUDIT_DEBUG || '').toLowerCase() === '1';
}

function debugLog(message, details) {
  if (!shouldDebug()) return;
  if (details !== undefined) {
    console.log(`[crawl-debug] ${message}`, details);
  } else {
    console.log(`[crawl-debug] ${message}`);
  }
}

/**
 * Fetch links from a page. Returns normalized same-site URLs.
 */
async function extractLinks(page, origin) {
  // First, ensure the page has rendered links (don't try to extract before DOM is ready)
  let linkCount = 0;
  let hrefs = [];
  
  try {
    // Try to count links on page
    try {
      linkCount = await page.$$eval('a[href]', (anchors) => anchors.length);
      debugLog('Initial link count on page', { url: page.url(), linkCount });
    } catch (countErr) {
      debugLog('Error counting links, trying to extract anyway', { url: page.url(), error: countErr.message });
    }
    
    // If no links found on first try, wait up to 5 seconds for DOM to render
    if (linkCount === 0) {
      debugLog('No links found initially, waiting for DOM...', { url: page.url() });
      try {
        // OPTIMIZATION: Reduced timeout from 5000ms to 2500ms (gov sites are mostly server-rendered)
        await page.waitForFunction(() => document.querySelectorAll('a[href]').length > 0, {
          timeout: 2500,
        });
        linkCount = await page.$$eval('a[href]', (anchors) => anchors.length);
        debugLog('Links found after wait', { url: page.url(), linkCount });
      } catch (waitErr) {
        debugLog('Wait for links timed out or failed', { url: page.url(), error: waitErr.message });
        // Don't return early - still try to extract what we can
      }
    }

    // Extract href attributes from all links
    try {
      hrefs = await page.$$eval('a[href]', (anchors) => 
        anchors
          .map((a) => {
            const href = a.getAttribute('href');
            return href ? href.trim() : null;
          })
          .filter(Boolean)
      );
      debugLog('Successfully extracted hrefs', { url: page.url(), hrefCount: hrefs.length });
    } catch (extractErr) {
      debugLog('Failed to extract hrefs with $$eval', { url: page.url(), error: extractErr.message });
      // Fallback: try evaluate() instead
      try {
        hrefs = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href'))
            .filter(Boolean);
        });
        debugLog('Successfully extracted hrefs using evaluate()', { url: page.url(), hrefCount: hrefs.length });
      } catch (fallbackErr) {
        debugLog('Failed fallback href extraction', { url: page.url(), error: fallbackErr.message });
        return [];
      }
    }
  } catch (err) {
    debugLog('Unexpected error in extractLinks', { url: page.url(), error: err.message });
    return [];
  }

  debugLog('Extracted raw hrefs from page', { url: page.url(), hrefCount: hrefs.length, uniqueUrls: new Set(hrefs).size });

  const result = [];
  const skippedReasons = { notUrl: 0, wrongOrigin: 0, alreadyNormalized: 0, success: 0 };
  
  for (const href of hrefs) {
    const normalized = normalizeUrl(href, origin);
    if (!normalized) {
      skippedReasons.notUrl++;
      continue;
    }
    if (!isSameSiteUrl(normalized, origin)) {
      skippedReasons.wrongOrigin++;
      debugLog('Link is different origin', { href, normalized, origin });
      continue;
    }
    result.push(normalized);
    skippedReasons.success++;
  }

  debugLog('Link extraction summary', { 
    url: page.url(), 
    valid: result.length, 
    ...skippedReasons 
  });
  
  return result;
}

/**
 * Crawl a site and return an array of { url, depth } objects.
 *
 * @param {string} startUrl
 * @param {{ maxPages?: number, maxDepth?: number, timeoutMs?: number, concurrency?: number, context?: BrowserContext }} options
 *
 * If options.context is provided, crawler reuses it (caller owns lifecycle).
 * If not provided, crawler launches its own browser/context (backward compatible).
 */
async function crawlSiteUrls(startUrl, options = {}) {
  const maxPages   = Number(options.maxPages)   > 0 ? Number(options.maxPages)   : 20;
  const maxDepth   = Number(options.maxDepth)  >= 0 ? Number(options.maxDepth)   : 3;
  const timeoutMs  = Number(options.timeoutMs)  > 0 ? Number(options.timeoutMs)  : 18000;
  const concurrencyCap = process.env.NODE_ENV === 'production' ? 2 : 5;
  const concurrency = Math.min(Number(options.concurrency) > 0 ? Number(options.concurrency) : 3, concurrencyCap);

  const parsedStart = new URL(startUrl);
  const origin = parsedStart.origin;
  const normalizedStart = normalizeUrl(startUrl, origin);
  if (!normalizedStart) return [];

  // Use provided context, or launch own browser if not provided.
  const externalContext = Boolean(options.context);
  let browser = null;
  let context = options.context;

  if (!context) {
    browser = await chromium.launch({
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
    context = await browser.newContext({ ignoreHTTPSErrors: true });

    // Block heavy resources (only if we created the context ourselves).
    await context.route('**/*', (route) => {
      if (BLOCKED_RESOURCE_TYPES.has(route.request().resourceType())) return route.abort();
      return route.continue();
    });
  }

  const visitedKeys = new Set([dedupKey(normalizedStart)]);
  // BFS queue: { url, depth }
  const queue = [{ url: normalizedStart, depth: 0 }];
  const discovered = [];

  debugLog('Starting crawl', { 
    startUrl, 
    normalizedStart,
    origin, 
    maxPages, 
    maxDepth, 
    concurrency,
    homepageKey: dedupKey(normalizedStart)
  });

  try {
    let iteration = 0;
    while (queue.length > 0 && discovered.length < maxPages) {
      iteration++;
      debugLog(`Crawl iteration ${iteration}`, { 
        queueSize: queue.length, 
        discoveredSoFar: discovered.length,
        pagesNeeded: maxPages - discovered.length
      });

      // Drain up to `concurrency` items from the queue at once.
      const batch = [];
      while (queue.length > 0 && batch.length < concurrency && discovered.length + batch.length < maxPages) {
        batch.push(queue.shift());
      }
      if (batch.length === 0) {
        debugLog('No more items in batch, breaking', { queueSize: queue.length });
        break;
      }

      debugLog('Processing batch', { batchSize: batch.length, queueSize: queue.length, discovered: discovered.length });

      // Visit all pages in this batch concurrently.
      const batchResults = await Promise.all(
        batch.map(async (item) => {
          const page = await context.newPage();
          try {
            debugLog('Navigating to', { url: item.url, depth: item.depth });
            const response = await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
            debugLog('Navigation complete', { url: item.url, depth: item.depth, statusCode: response?.status() });

            // OPTIMIZATION: Reduced wait from 800ms to dynamic 500ms timeout
            // Wait for network to settle but cap at 500ms
            await Promise.race([
              page.waitForLoadState('networkidle'),
              new Promise(resolve => setTimeout(resolve, 500)),
            ]);

            // Only extract child links if we haven't hit depth limit.
            let childLinks = [];
            if (item.depth < maxDepth) {
              debugLog('Extracting child links (depth limit not reached)', { url: item.url, currentDepth: item.depth, maxDepth });
              childLinks = await extractLinks(page, origin);
            } else {
              debugLog('Skipping child link extraction (depth limit reached)', { url: item.url, currentDepth: item.depth, maxDepth });
            }
            
            return { item, childLinks, error: null };
          } catch (err) {
            debugLog('Page load error', { url: item.url, error: err.message, code: err.code });
            return { item, childLinks: [], error: err.message };
          } finally {
            await page.close().catch(() => {});
          }
        })
      );

      for (const { item, childLinks, error } of batchResults) {
        discovered.push(item);
        debugLog('Page discovered and added', { url: item.url, totalDiscovered: discovered.length, hadError: !!error });

        if (error) {
          debugLog('Skipping link extraction due to page error', { url: item.url, error });
          continue;
        }

        debugLog('Processing child links', { url: item.url, linkCount: childLinks.length });
        
        for (const href of childLinks) {
          const key = dedupKey(href);
          if (visitedKeys.has(key)) {
            debugLog('Duplicate URL, skipping', { url: href });
            continue;
          }
          if (visitedKeys.size >= maxPages * 2) {
            debugLog('Visited keys limit reached, stopping link processing', { size: visitedKeys.size, limit: maxPages * 2 });
            break;
          }
          visitedKeys.add(key);
          queue.push({ url: href, depth: item.depth + 1 });
          debugLog('New URL queued', { url: href, depth: item.depth + 1, queueSize: queue.length });
        }
      }
    }

    debugLog('Crawl complete', { discovered: discovered.length, maxPages, finalQueueSize: queue.length });
    return discovered;
  } finally {
    // Only close if we created the context (backward compatibility).
    if (!externalContext) {
      await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  }
}

module.exports = { crawlSiteUrls };
