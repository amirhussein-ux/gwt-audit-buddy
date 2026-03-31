const {
  detectPst,
  detectHomeLink,
  detectLogoLinksHome,
  detectNavLinkByIntent,
  debugLog,
} = require('./gwtHeuristics');

// Shared page-level signal inspection.
// Why: avoid duplicated/fragile detection logic across auditEngine vs gwtChecker.
// This is the single place where we determine core GWT signals (PST, logo->home, about/contact, etc.).
async function inspectPageSignals(page, targetOrigin) {
  // Detect bot-protection/challenge pages (e.g., Cloudflare “Checking your browser”).
  // Why: otherwise we produce false negatives by auditing the challenge shell instead of the real site.
  try {
    const blocked = await page.evaluate(() => {
      const title = (document.title || '').toLowerCase();
      const text = (document.body?.innerText || '').slice(0, 8000).toLowerCase();

      const phraseHit = /checking your browser|just a moment|verify you are human|attention required|enable javascript and cookies|ray id|cloudflare|cdn-cgi|challenge/.test(
        `${title} ${text}`
      );

      const cfSelectors = [
        '#challenge-form',
        '#cf-challenge-running',
        '[data-cf-beacon]',
        'script[src*="/cdn-cgi/"]',
        'script[src*="challenge-platform"]',
        'form[action*="/cdn-cgi/"]',
        'a[href*="cloudflare.com"]',
        'a[href*="/cdn-cgi/"]',
      ];
      const selectorHit = cfSelectors.some((sel) => Boolean(document.querySelector(sel)));

      // Cloudflare “challenge” pages often include cloudflare.com links and/or /cdn-cgi assets.
      // Treat either strong phrase evidence or a strong selector hit as blocked.
      return phraseHit || selectorHit;
    }).catch(() => false);

    if (blocked) {
      debugLog('Bot protection detected; skipping signal detection', { url: page.url(), blocked: true });
      return {
        pstFound: false,
        logoLinksHome: false,
        transparencySealLinked: false,
        breadcrumbEnabled: false,
        hasAbout: false,
        hasContact: false,
        govphTopMenu: false,
        menuSignature: '',
        nonDescriptiveLinkCount: 0,
        citizensCharter: false,
        blockedByBotProtection: true,
        blockReason: 'bot-protection',
      };
    }
  } catch {
    // ignore
  }

  // Core, high-priority signals (robust heuristic detectors)
  let homeLinkFound = false;
  let logoLinksHome = false;
  let hasAbout = false;
  let hasContact = false;
  let pstFound = false;

  try {
    const [homeResult, logoResult, aboutResult, contactResult, pstResult] = await Promise.all([
      detectHomeLink(page, targetOrigin),
      detectLogoLinksHome(page, targetOrigin),
      detectNavLinkByIntent(page, 'about'),
      detectNavLinkByIntent(page, 'contact'),
      detectPst(page),
    ]);

    homeLinkFound = homeResult.found;
    logoLinksHome = logoResult.found;
    hasAbout = aboutResult.found;
    hasContact = contactResult.found;
    pstFound = pstResult.found;

    debugLog('inspectPageSignals core detectors', {
      url: typeof page.url === 'function' ? page.url() : undefined,
      targetOrigin,
      homeResult,
      logoResult,
      aboutResult,
      contactResult,
      pstResult,
    });
  } catch {
    // best-effort only
  }

  // Secondary signals (still best-effort, but not the main source of PSA false negatives)
  let transparencySealLinked = false;
  try {
    const direct = await page.$('img[alt*="transparency" i], img[title*="transparency" i], img[alt*="seal" i], img[title*="seal" i]');
    if (direct) {
      const parent = await direct.evaluateHandle((n) => n.closest('a'));
      if (parent) {
        const href = await parent.getProperty('href').then((p) => p.jsonValue()).catch(() => null);
        transparencySealLinked = Boolean(href);
      } else {
        transparencySealLinked = true;
      }
    } else {
      const hasBg = await page.$$eval('*', (els) => els.some((el) => {
        const bg = window.getComputedStyle(el).backgroundImage || '';
        return /transparency|seal/i.test(bg);
      }));
      if (hasBg) transparencySealLinked = true;

      const svgFound = await page.$$eval('svg title, svg desc', (els) => els.some((e) => /transparency|seal/i.test(e.textContent || '')));
      if (svgFound) transparencySealLinked = true;
    }

    if (!transparencySealLinked) {
      const pdf = await page.$('a[href$=".pdf"][href*="transparency" i]');
      if (pdf) transparencySealLinked = true;
    }
  } catch {
    // ignore
  }

  let citizensCharter = false;
  try {
    const pageText = await page.evaluate(() => document.body?.innerText || '');
    citizensCharter = /citizen.*charter/i.test(pageText) || /citizen's charter/i.test(pageText);

    if (!citizensCharter) {
      const link = await page.$('a[href*="citizen" i], a[href*="charter" i], a[title*="citizen" i]');
      if (link) citizensCharter = true;
    }

    if (!citizensCharter) {
      const pdfAnchor = await page.$('a[href$=".pdf"][href*="citizen" i], a[href$=".pdf"][href*="charter" i]');
      if (pdfAnchor) citizensCharter = true;
    }
  } catch {
    // ignore
  }

  let nonDescriptiveLinkCount = 0;
  try {
    nonDescriptiveLinkCount = await page.evaluate(() => {
      const badPatterns = [/^click here$/i, /^here$/i, /^read more$/i, /^more$/i, /^learn more$/i];
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors.filter((anchor) => {
        const text = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
        return badPatterns.some((pattern) => pattern.test(text));
      }).length;
    });
  } catch {
    // ignore
  }

  let menuSignature = '';
  try {
    const topTexts = await page.$$eval('header a, nav a, [role="banner"] a', (els) => els.slice(0, 20).map((e) => (e.textContent || '').trim().toLowerCase()));
    menuSignature = topTexts.join(' | ');
  } catch {
    // ignore
  }

  let breadcrumbEnabled = false;
  try {
    breadcrumbEnabled = Boolean(await page.$('nav[aria-label*="breadcrumb" i], .breadcrumb, ol.breadcrumb, ul.breadcrumb'));
  } catch {
    // ignore
  }

  let govphTopMenu = false;
  try {
    govphTopMenu = Boolean(await page.$('a[href*="gov.ph"]'));
  } catch {
    // ignore
  }

  return {
    pstFound,
    // If either detector finds a usable home affordance, treat as present.
    logoLinksHome: logoLinksHome || homeLinkFound,
    transparencySealLinked,
    breadcrumbEnabled,
    hasAbout,
    hasContact,
    govphTopMenu,
    menuSignature,
    nonDescriptiveLinkCount,
    citizensCharter,
    blockedByBotProtection: false,
    blockReason: null,
  };
}

module.exports = {
  inspectPageSignals,
};
