/**
 * gwtHeuristics.js — MASID refined
 *
 * Key changes vs original:
 * 1. SPEED: ensureNetworkIdle timeout cut from 5000ms → 2500ms. The `networkidle`
 *    wait is a major bottleneck on gov sites with long-polling connections.
 *    We rely on the scraper's domcontentloaded + waitForTimeout instead.
 * 2. SPEED: detectNavLinkByIntent global scan now batches all getText() calls
 *    in a single page.$$eval instead of looping locator.nth(i) — massive speedup
 *    on large nav menus.
 * 3. HEURISTIC QUALITY: detectPst no longer uses "time in header" as a catch-all
 *    fallback — this was producing false positives on sites that show news dates
 *    or countdown timers in their headers. Tightened to require PST/PHT timezone
 *    evidence alongside a time pattern.
 * 4. HEURISTIC QUALITY: detectNavLinkByIntent 'about' pattern now also matches
 *    Tagalog variants common in Philippine LGU sites (e.g., "Tungkol Sa", "Kasaysayan").
 * 5. HEURISTIC QUALITY: detectNavLinkByIntent 'contact' now matches
 *    "Makipag-ugnayan" and "Mga Tanggapan" (Filipino contact equivalents).
 * 6. CORRECTNESS: Slug-fallback in pageSignals was using /\/(about|profile|agency)/
 *    which also matched e.g. /downloads/agency-forms. Tightened to require the
 *    segment to appear as a full path component.
 */

async function ensureNetworkIdle(page, timeoutMs = 2500) {
  // Keep the wait but shorten it — gov sites rarely finish networkidle within 5s anyway.
  try {
    await page.waitForLoadState('networkidle', { timeout: timeoutMs });
  } catch {
    // ignore — domcontentloaded is sufficient for heuristics
  }
}

function isHomepageHrefLoose(rawHref, origin, currentUrl) {
  if (!rawHref || rawHref === '#') return false;
  try {
    const base     = currentUrl || origin;
    const resolved = new URL(rawHref, base);
    if (resolved.origin !== origin) return false;
    const path = (resolved.pathname || '/').replace(/\/+$/, '').toLowerCase();
    return ['', '/', '/index.html', '/index.php', '/home', '/home-page', '/homepage'].includes(path);
  } catch { return false; }
}

// ─── PST detection ───────────────────────────────────────────────────────────
async function detectPst(page) {
  await ensureNetworkIdle(page);

  // 1. Wait for known GWT PST selectors (short timeout — don't block the whole audit).
  try {
    await page.waitForSelector(
      '#pst-container, .pst-time, [id*="pst" i], [class*="pst" i], [id*="pht" i], [class*="pht" i]',
      { timeout: 2500 }
    );
    return { found: true, reason: 'selector-wait' };
  } catch { /* continue */ }

  // 2. Count-based selector check.
  const selectorHit = await page
    .locator('#pst-container, .pst-time, [id*="pst" i], [class*="pst" i], [id*="pht" i], [class*="pht" i]')
    .count().then((c) => c > 0).catch(() => false);
  if (selectorHit) return { found: true, reason: 'selector' };

  // 3. Explicit "Philippine Standard Time" phrase.
  const phraseHit = await page
    .getByText(/philippine\s+standard\s+time/i)
    .count().then((c) => c > 0).catch(() => false);
  if (phraseHit) return { found: true, reason: 'text' };

  // 4. Timezone evidence (PHT/PST/UTC+8) combined with a clock time pattern.
  //    Require BOTH to avoid false positives from news dates or countdowns.
  try {
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const hasTz    = /(pht\b|\bpst\b|gmt\s*\+?8|utc\s*\+?8|\+08:00)/i.test(bodyText);
    const hasTime  = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/i.test(bodyText);
    if (hasTz && hasTime) return { found: true, reason: 'regex-tz+time' };
  } catch { /* continue */ }

  // 5. "Standard Time" text ONLY in a known header/nav element.
  //    Tighter than before — checks actual elements, not bounding boxes.
  try {
    const found = await page.evaluate(() => {
      const headerEls = Array.from(document.querySelectorAll(
        'header, [role="banner"], nav, .masthead, .header, .top-bar'
      ));
      return headerEls.some((el) => /standard\s+time/i.test(el.textContent || ''));
    });
    if (found) return { found: true, reason: 'standard-time-in-header-el' };
  } catch { /* continue */ }

  return { found: false, reason: 'none' };
}

// ─── Home link detection ─────────────────────────────────────────────────────
async function detectHomeLink(page, origin) {
  await ensureNetworkIdle(page);

  const byRole = await page
    .getByRole('link', { name: /\bhome\b|homepage|go\s+to\s+home/i })
    .count().then((c) => c > 0).catch(() => false);
  if (byRole) return { found: true, reason: 'role' };

  const byHref = await page
    .locator('a[href="/"], a[href="./"], a[href$="/"], a[href*="index.html" i], a[href*="index.php" i], a[href*="/home" i]')
    .count().then((c) => c > 0).catch(() => false);
  return byHref ? { found: true, reason: 'href' } : { found: false, reason: 'none' };
}

// ─── Logo → home detection ───────────────────────────────────────────────────
async function detectLogoLinksHome(page, origin) {
  await ensureNetworkIdle(page);

  const candidates = page.locator(
    'header a:has(img), header a:has(svg), [role="banner"] a:has(img), [role="banner"] a:has(svg), .masthead a:has(img), .masthead a:has(svg), a[class*="logo" i], .logo a'
  );

  const total = await candidates.count().catch(() => 0);
  const limit = Math.min(total, 25);
  for (let i = 0; i < limit; i++) {
    const href = await candidates.nth(i).getAttribute('href').catch(() => null);
    if (isHomepageHrefLoose(href, origin, page.url())) return { found: true, reason: 'anchor' };
  }

  const wrapped = page.locator('header a:has(img), header a:has(svg), [role="banner"] a:has(img), [role="banner"] a:has(svg)');
  const wCount  = await wrapped.count().catch(() => 0);
  for (let i = 0; i < Math.min(wCount, 25); i++) {
    const href = await wrapped.nth(i).getAttribute('href').catch(() => null);
    if (isHomepageHrefLoose(href, origin, page.url())) return { found: true, reason: 'wrapped-img' };
  }

  return { found: false, reason: 'none' };
}

// ─── Nav link intent detection ────────────────────────────────────────────────
const INTENT_PATTERNS = {
  about: {
    text: /^about(\s+\w+)?$|profile|history|mandate|background|who\s+we\s+are|tungkol\s+(sa|amin)|kasaysayan|organisasyon/i,
    href: /\/(about|profile|mandate|vision|history|organization)(?:[\/\?#]|$)/i,
  },
  contact: {
    text: /contact(\s+us)?|get\s+in\s+touch|reach\s+us|directory|inquir|help|support|offices?|makipag-ugnayan|mga\s+tanggapan/i,
    href: /\/(contact|contacts|get-in-touch|directory|inquir|help|tanggapan)(?:[\/\?#]|$)/i,
  },
};

async function detectNavLinkByIntent(page, intent) {
  await ensureNetworkIdle(page);

  const { text: textPattern, href: hrefPattern } = INTENT_PATTERNS[intent] || {};
  if (!textPattern || !hrefPattern) return { found: false, reason: 'unknown-intent' };

  // ── Priority 1: header/nav text match (batched — much faster than nth loop) ──
  try {
    const navData = await page.$$eval(
      'header a, nav a, [role="navigation"] a, .nav a, .menu a, footer a, [role="contentinfo"] a',
      (anchors) => anchors.slice(0, 80).map((a) => ({
        text: (a.textContent || '').trim(),
        ariaLabel: a.getAttribute('aria-label') || '',
        href: a.getAttribute('href') || '',
      }))
    );

    for (const { text, ariaLabel, href } of navData) {
      const combined = `${text} ${ariaLabel}`.trim();
      if (textPattern.test(combined) || hrefPattern.test(href)) {
        return { found: true, reason: 'nav-batch' };
      }
    }
  } catch { /* continue */ }

  // ── Priority 2: href-based global scan (reliable even when link text is an icon) ──
  try {
    const allHrefs = await page.$$eval(
      'a[href]',
      (anchors) => anchors.slice(0, 250).map((a) => a.getAttribute('href') || '')
    );
    for (const href of allHrefs) {
      if (hrefPattern.test(href)) return { found: true, reason: 'global-href' };
    }
  } catch { /* continue */ }

  // ── Priority 3: global text scan (hero tiles, dynamic sections, etc.) ──
  try {
    const allTexts = await page.$$eval(
      'a, button, h1, h2, h3, span',
      (els) => els.slice(0, 200).map((e) => (e.textContent || '').trim())
    );
    for (const text of allTexts) {
      if (textPattern.test(text)) return { found: true, reason: 'global-text' };
    }
  } catch { /* continue */ }

  return { found: false, reason: 'none' };
}

// ─── Debug logger ────────────────────────────────────────────────────────────
function shouldDebug() {
  return String(process.env.AUDIT_DEBUG || '').toLowerCase() === '1';
}

function debugLog(message, details) {
  if (!shouldDebug()) return;
  details !== undefined ? console.log(`[audit-debug] ${message}`, details) : console.log(`[audit-debug] ${message}`);
}

module.exports = {
  ensureNetworkIdle,
  isHomepageHrefLoose,
  detectPst,
  detectHomeLink,
  detectLogoLinksHome,
  detectNavLinkByIntent,
  debugLog,
};