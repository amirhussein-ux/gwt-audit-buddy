async function ensureNetworkIdle(page, timeoutMs = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout: timeoutMs });
  } catch {
    // ignore
  }

  // CRITICAL: wait until meaningful DOM is present before detection.
  // Many real-world sites render navigation + clocks after initial load.
  try {
    await page.waitForFunction(() => {
      return document.querySelectorAll('a').length > 10;
    }, { timeout: 7000 });
  } catch {
    // Not fatal: some pages legitimately have fewer links.
  }
}

function isHomepageHrefLoose(rawHref, origin, currentUrl) {
  if (!rawHref || rawHref === '#') {
    return false;
  }

  try {
    const base = currentUrl || origin;
    const resolved = new URL(rawHref, base);
    if (resolved.origin !== origin) {
      return false;
    }

    const path = (resolved.pathname || '/').replace(/\/+$/, '').toLowerCase();
    return (
      path === '' ||
      path === '/' ||
      path === '/index.html' ||
      path === '/index.php' ||
      path === '/home' ||
      path === '/home-page' ||
      path === '/homepage'
    );
  } catch {
    return false;
  }
}

async function detectPst(page) {
  await ensureNetworkIdle(page);

  // Strategy 1: Known GWT PST selectors (fastest — check these first)
  try {
    await page.waitForSelector(
      '#pst-container, .pst-time, [id*="pst" i], [class*="pst" i], [id*="pht" i], [class*="pht" i]',
      { timeout: 2500 }
    );
    return { found: true, reason: 'selector-wait' };
  } catch { /* continue */ }

  const selectorHit = await page
    .locator('#pst-container, .pst-time, [id*="pst" i], [class*="pst" i], [id*="pht" i], [class*="pht" i]')
    .count().then((c) => c > 0).catch(() => false);
  if (selectorHit) return { found: true, reason: 'selector' };

  // Strategy 2: Explicit "Philippine Standard Time" phrase
  const phraseHit = await page
    .getByText(/philippine\s+standard\s+time/i)
    .count().then((c) => c > 0).catch(() => false);
  if (phraseHit) return { found: true, reason: 'text' };

  // Strategy 3: Timezone marker (PHT/PST/GMT+8) + time pattern anywhere on page
  // Requires BOTH to avoid false positives from news publish dates
  try {
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const hasTz   = /(pht\b|\bpst\b|gmt\s*\+?8|utc\s*\+?8|\+08:00)/i.test(bodyText);
    const hasTime = /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(bodyText);
    if (hasTz && hasTime) return { found: true, reason: 'regex-tz+time' };
  } catch { /* continue */ }

  // Strategy 4: "Standard Time" phrase in any header/nav element (DOM-based, not position-based)
  // Position-based checks (getBoundingClientRect) are unreliable in headless mode.
  try {
    const stdTimeInHeader = await page.evaluate(() => {
      const headerEls = document.querySelectorAll(
        'header, [role="banner"], nav, .top-bar, .top-header, .site-top, ' +
        '.masthead, .topbar, .top-menu, [class*="top-bar" i], [class*="topbar" i], ' +
        '[class*="header" i], [id*="header" i], [id*="topbar" i]'
      );
      return Array.from(headerEls).some(el => /standard\s+time/i.test(el.textContent || ''));
    });
    if (stdTimeInHeader) return { found: true, reason: 'standard-time-in-header-el' };
  } catch { /* continue */ }

  // Strategy 5: Live clock signature — HH:MM:SS with AM/PM in a top-level structural element.
  // A time WITH seconds (HH:MM:SS) is the signature of a live PST widget — static dates
  // never show seconds. This catches sites like mandaluyong.gov.ph whose top bar shows
  // "Monday, April 6, 2026  9:21:56 AM  31.38°C" with no explicit PST/PHT label.
  try {
    const liveClockFound = await page.evaluate(() => {
      // Search only within known top-bar/header containers first
      const topContainers = Array.from(document.querySelectorAll(
        'header, [role="banner"], nav, .top-bar, .topbar, .site-top, ' +
        '.top-header, .masthead, [class*="topbar" i], [class*="top-bar" i], ' +
        '[id*="topbar" i], [id*="top-bar" i], [id*="header" i]'
      ));

      // HH:MM:SS AM/PM pattern — seconds present = live clock = PST widget
      const liveClockPattern = /\b\d{1,2}:\d{2}:\d{2}\s*(?:am|pm)?\b/i;
      // Also: day-of-week + date + time together is a strong PST widget signature
      const dayDateTimePattern = /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday).{0,30}\d{1,2}:\d{2}/i;

      for (const container of topContainers) {
        const text = container.textContent || '';
        if (liveClockPattern.test(text) || dayDateTimePattern.test(text)) return true;
      }

      // Fallback: scan first 3 block-level elements at root level for the same patterns
      const rootBlocks = Array.from(document.body?.children || []).slice(0, 5);
      for (const el of rootBlocks) {
        const text = el.textContent || '';
        if (liveClockPattern.test(text) || dayDateTimePattern.test(text)) return true;
      }

      return false;
    });
    if (liveClockFound) return { found: true, reason: 'live-clock-signature' };
  } catch { /* continue */ }

  // Strategy 6: Any time pattern in any element that is structurally "above" the main content.
  // Last resort — avoids bounding rect (unreliable headless) by using DOM order instead.
  try {
    const timeBeforeMain = await page.evaluate(() => {
      const main = document.querySelector('main, [role="main"], #main, .main-content, #content');
      if (!main) return false;
      // Collect all text nodes that appear before <main> in DOM order
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const preMainTexts = [];
      let node = walker.nextNode();
      while (node) {
        if (main.contains(node)) break;
        preMainTexts.push(node.textContent || '');
        node = walker.nextNode();
      }
      const preMainText = preMainTexts.join(' ');
      return /\b\d{1,2}:\d{2}:\d{2}\s*(?:am|pm)?\b/i.test(preMainText);
    });
    if (timeBeforeMain) return { found: true, reason: 'time-before-main' };
  } catch { /* continue */ }

  return { found: false, reason: 'none' };
}

async function detectHomeLink(page, origin) {
  await ensureNetworkIdle(page);

  const byRole = await page
    .getByRole('link', { name: /\bhome\b|homepage|go\s+to\s+home/i })
    .count()
    .then((c) => c > 0)
    .catch(() => false);

  if (byRole) {
    return { found: true, reason: 'role' };
  }

  const byHref = await page
    .locator('a[href="/"], a[href="./"], a[href$="/"], a[href*="index.html" i], a[href*="index.php" i], a[href*="/home" i]')
    .count()
    .then((c) => c > 0)
    .catch(() => false);

  return byHref ? { found: true, reason: 'href' } : { found: false, reason: 'none' };
}

async function detectLogoLinksHome(page, origin) {
  await ensureNetworkIdle(page);

  const candidates = page.locator(
    'header a:has(img), header a:has(svg), [role="banner"] a:has(img), [role="banner"] a:has(svg), .masthead a:has(img), .masthead a:has(svg), a[class*="logo" i], .logo a'
  );

  const total = await candidates.count().catch(() => 0);
  const limit = Math.min(total, 25);
  for (let i = 0; i < limit; i += 1) {
    const href = await candidates.nth(i).getAttribute('href').catch(() => null);
    if (isHomepageHrefLoose(href, origin, page.url())) {
      return { found: true, reason: 'anchor' };
    }
  }

  // fallback: any prominent header img wrapped by an <a> that points home
  const wrappedImgAnchors = page.locator('header a:has(img), header a:has(svg), [role="banner"] a:has(img), [role="banner"] a:has(svg)');
  const wrappedCount = await wrappedImgAnchors.count().catch(() => 0);
  const wrappedLimit = Math.min(wrappedCount, 25);
  for (let i = 0; i < wrappedLimit; i += 1) {
    const href = await wrappedImgAnchors.nth(i).getAttribute('href').catch(() => null);
    if (isHomepageHrefLoose(href, origin, page.url())) {
      return { found: true, reason: 'wrapped-img' };
    }
  }

  return { found: false, reason: 'none' };
}

async function detectNavLinkByIntent(page, intent) {
  await ensureNetworkIdle(page);

  const patterns = {
    // Flexible pattern matching (no exact strings): covers “About PSA”, “Profile”, etc.
    // Updated to prefer strings starting with "About " or contain common LGU naming
    about: /^about\s+|profile|history|mandate|background/i,
    contact: /contact|get\s+in\s+touch|reach\s+us|directory|inquiries|help|support|offices?/i,
  };

  const hrefPatterns = {
    about: /about|profile|mandate|vision/i,
    contact: /contact|contacts|get-in-touch|directory|inquiries|help/i,
  };

  const textPattern = patterns[intent];
  const hrefPattern = hrefPatterns[intent];

  if (!textPattern || !hrefPattern) {
    return { found: false, reason: 'unknown-intent' };
  }

  const areas = [
    'header a, nav a, [role="navigation"] a, .nav a, .menu a',
    'footer a, [role="contentinfo"] a, .footer a',
  ];

  for (const selector of areas) {
    const loc = page.locator(selector);
    const count = await loc.count().catch(() => 0);
    const limit = Math.min(count, 50);

    for (let i = 0; i < limit; i += 1) {
      const el = loc.nth(i);
      const [text, ariaLabel, href] = await Promise.all([
        el.textContent().catch(() => ''),
        el.getAttribute('aria-label').catch(() => ''),
        el.getAttribute('href').catch(() => ''),
      ]);

      const combined = `${text || ''} ${ariaLabel || ''}`.trim();
      if (textPattern.test(combined) || hrefPattern.test(href || '')) {
        return { found: true, reason: selector.includes('footer') ? 'footer' : 'header' };
      }
    }
  }

  // IMPORTANT: global scanning across full DOM (not just header/nav/footer).
  // This catches hero tiles, nested spans inside anchors, and dynamically-rendered sections.
  try {
    const globalCandidates = page.locator('a, button, h1, h2, h3, span');
    const count = await globalCandidates.count().catch(() => 0);
    const limit = Math.min(count, 200);
    for (let i = 0; i < limit; i += 1) {
      const text = await globalCandidates.nth(i).textContent().catch(() => '');
      if (textPattern.test(text || '')) {
        debugLog(`${intent} detected`, { strategy: 'global-text', text: String(text || '').trim().slice(0, 120) });
        return { found: true, reason: 'global-text' };
      }
    }
  } catch {
    // ignore
  }

  // VERY IMPORTANT: global href-based detection (often more reliable than link text)
  try {
    const anchors = page.locator('a[href]');
    const aCount = await anchors.count().catch(() => 0);
    const aLimit = Math.min(aCount, 200);

    const sample = [];
    for (let i = 0; i < Math.min(aLimit, 20); i += 1) {
      const a = anchors.nth(i);
      const [href, text] = await Promise.all([
        a.getAttribute('href').catch(() => ''),
        a.textContent().catch(() => ''),
      ]);
      sample.push({ href: href || '', text: String(text || '').trim().slice(0, 80) });
    }
    debugLog('Detected links (sample)', sample);

    for (let i = 0; i < aLimit; i += 1) {
      const href = await anchors.nth(i).getAttribute('href').catch(() => '');
      if (hrefPattern.test(href || '')) {
        debugLog(`${intent} detected`, { strategy: 'global-href', href });
        return { found: true, reason: 'global-href' };
      }
    }
  } catch {
    // ignore
  }

  // extra fallback: headings/buttons
  const headings = page.locator('h1, h2, h3, button, [role="button"]');
  const hCount = await headings.count().catch(() => 0);
  const hLimit = Math.min(hCount, 50);
  for (let i = 0; i < hLimit; i += 1) {
    const text = await headings.nth(i).textContent().catch(() => '');
    if (textPattern.test(text || '')) {
      return { found: true, reason: 'heading' };
    }
  }

  return { found: false, reason: 'none' };
}

function shouldDebug() {
  return String(process.env.AUDIT_DEBUG || '').toLowerCase() === '1';
}

function debugLog(message, details) {
  if (!shouldDebug()) {
    return;
  }

  // Mandatory troubleshooting logs (only when AUDIT_DEBUG=1).
  // Keep logs short; print small samples only.
  if (details !== undefined) {
    console.log(`[audit-debug] ${message}`, details);
  } else {
    console.log(`[audit-debug] ${message}`);
  }
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