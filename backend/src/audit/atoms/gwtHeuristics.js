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
      return document.querySelectorAll('a').length > 20;
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

  // Many GWT sites inject PST asynchronously; give it a short chance to appear.
  try {
    await page.waitForSelector(
      '#pst-container, .pst-time, [id*="pst" i], [class*="pst" i], [id*="pht" i], [class*="pht" i]',
      { timeout: 3000 }
    );
    return { found: true, reason: 'selector-wait' };
  } catch {
    // continue to other strategies
  }

  const selectorHit = await page
    .locator('#pst-container, .pst-time, [id*="pst" i], [class*="pst" i], [id*="pht" i], [class*="pht" i]')
    .count()
    .then((c) => c > 0)
    .catch(() => false);

  if (selectorHit) {
    return { found: true, reason: 'selector' };
  }

  const phraseHit = await page
    .getByText(/philippine\s+standard\s+time/i)
    .count()
    .then((c) => c > 0)
    .catch(() => false);

  if (phraseHit) {
    return { found: true, reason: 'text' };
  }

  // last resort: body text regex checks for clocks rendered without stable selectors
  try {
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const hasTz = /(pht\b|\bpst\b|gmt\s*\+?8|utc\s*\+?8|\+08:00)/i.test(bodyText);
    const hasTime = /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(bodyText);
    const found = hasTz && hasTime;
    return found ? { found: true, reason: 'regex' } : { found: false, reason: 'none' };
  } catch {
    return { found: false, reason: 'error' };
  }
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
    about: /about|profile|who\s+we\s+are|mandate|vision|overview|our\s+agency|about\s+the/i,
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
