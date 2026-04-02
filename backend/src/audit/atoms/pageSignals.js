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
        pstInMasthead: false,
        logoLinksHome: false,
        transparencySealLinked: false,
        breadcrumbEnabled: false,
        hasAbout: false,
        aboutMatchedText: null,
        hasContact: false,
        govphTopMenu: false,
        govphIsFirstTopMenu: false,
        standardFooterHasAgencyLinks: false,
        sitemapFound: false,
        sitemapXmlOnly: false,
        hasMandateMission: false,
        mandateMissionInAboutSection: false,
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
  let aboutMatchedText = null;
  let hasContact = false;
  let pstFound = false;
  let pstInMasthead = false;

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
    // If nav text didn't match, try a slug/href-based fallback for primary nav links
    if (!hasAbout) {
      try {
        const slugMatch = await page.evaluate(() => {
          const roots = Array.from(document.querySelectorAll('header, nav, [role="navigation"]')).filter(Boolean);
          const anchors = roots.length > 0
            ? roots.flatMap(r => Array.from(r.querySelectorAll('a[href]')))
            : Array.from(document.querySelectorAll('a[href]'));
          for (const a of anchors) {
            const href = a.getAttribute('href') || '';
            if (/\/(about|profile|agency)(?:[\/\?#]|$)/i.test(href)) {
              return { href, text: (a.textContent || '').trim() };
            }
          }
          return null;
        });
        if (slugMatch) {
          hasAbout = true;
          aboutMatchedText = slugMatch.href || slugMatch.text || null;
        }
      } catch (e) {
        // ignore
      }
    } else {
      // If detectNavLinkByIntent matched, capture a best-effort matched text sample
      try {
        const sample = await page.evaluate(() => {
          const candidates = Array.from(document.querySelectorAll('header a, nav a, [role="navigation"] a'));
          for (const a of candidates) {
            const txt = (a.textContent || '').trim();
            if (/^about\s+|profile|history|mandate|background/i.test(txt)) {
              return txt.slice(0, 120);
            }
          }
          return null;
        });
        if (sample) aboutMatchedText = sample;
      } catch {
        // ignore
      }
    }
    hasContact = contactResult.found;
    pstFound = pstResult.found;

    // Priority-2 placement signal for PST (masthead placement)
    pstInMasthead = await page.evaluate(() => {
      const el = document.querySelector('#pst-container, .pst-time, [id*="pst" i], [class*="pst" i], [id*="pht" i], [class*="pht" i]');
      return Boolean(el && el.closest && el.closest('header, [role="banner"], .masthead'));
    }).catch(() => false);

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
  let govphIsFirstTopMenu = false;
  try {
    const govMeta = await page.evaluate(() => {
      const topMenuRoot = document.querySelector(
        'header nav, header .menu, header .navbar, nav[role="navigation"], nav, .top-menu, .navbar, .menu'
      ) || document.querySelector('header, [role="banner"]');

      if (!topMenuRoot) {
        const govLink = document.querySelector('a[href*="gov.ph" i]');
        return {
          exists: Boolean(govLink),
          first: false,
        };
      }

      const anchors = Array.from(topMenuRoot.querySelectorAll('a[href]'));
      const govIndex = anchors.findIndex((a) => /gov\.ph/i.test(a.getAttribute('href') || '') || /gov\s*ph/i.test(a.textContent || ''));
      return {
        exists: govIndex >= 0,
        first: govIndex === 0,
      };
    });

    govphTopMenu = Boolean(govMeta?.exists);
    govphIsFirstTopMenu = Boolean(govMeta?.first);
  } catch {
    // ignore
  }

  let standardFooterHasAgencyLinks = false;
  try {
    standardFooterHasAgencyLinks = await page.evaluate(() => {
      const footer = document.querySelector('footer, [role="contentinfo"], .footer');
      if (!footer) {
        return false;
      }

      const links = Array.from(footer.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') || '');
      const agencyPattern = /gov\.ph|officialgazette\.gov\.ph|dbm\.gov\.ph|csc\.gov\.ph|coa\.gov\.ph|dilg\.gov\.ph|philippines/i;
      const count = links.filter((href) => agencyPattern.test(href)).length;
      return count >= 1;
    });
  } catch {
    // ignore
  }

  let sitemapFound = false;
  let sitemapXmlOnly = false;
  try {
    const sitemapMeta = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const sitemapAnchors = anchors.filter((a) => /site\s*map|sitemap/i.test((a.textContent || '') + ' ' + (a.getAttribute('href') || '')));
      const hasSitemap = sitemapAnchors.length > 0;
      if (!hasSitemap) {
        return { found: false, xmlOnly: false };
      }

      const allXml = sitemapAnchors.every((a) => /sitemap.*\.xml(\?|$)|\.xml(\?|$)/i.test(a.getAttribute('href') || ''));
      return {
        found: true,
        xmlOnly: allXml,
      };
    });

    sitemapFound = Boolean(sitemapMeta?.found);
    sitemapXmlOnly = Boolean(sitemapMeta?.xmlOnly);
  } catch {
    // ignore
  }

  let hasMandateMission = false;
  let mandateMissionInAboutSection = false;
  try {
    const aboutMeta = await page.evaluate(() => {
      const bodyText = (document.body?.innerText || '').toLowerCase();
      const hasMandate = /\bmandate\b|\bfunctions?\b|\bresponsibilit/i.test(bodyText);
      const hasMissionVision = /\bmission\b|\bvision\b/.test(bodyText);
      const hasBoth = hasMandate && hasMissionVision;

      const aboutContainer = document.querySelector(
        'section[id*="about" i], section[class*="about" i], section[id*="profile" i], section[class*="profile" i], article[id*="about" i], article[class*="about" i], .about, .profile'
      );

      let inAbout = false;
      if (aboutContainer) {
        const aboutText = (aboutContainer.textContent || '').toLowerCase();
        inAbout = /\bmandate\b|\bmission\b|\bvision\b/.test(aboutText);
      }

      if (!inAbout) {
        const aboutLink = Array.from(document.querySelectorAll('a[href]')).find((a) => /about|profile|who\s*we\s*are/i.test((a.textContent || '') + ' ' + (a.getAttribute('href') || '')));
        inAbout = Boolean(aboutLink);
      }

      const footer = document.querySelector('footer, [role="contentinfo"], .footer');
      if (footer && inAbout) {
        const footerText = (footer.textContent || '').toLowerCase();
        // If terms only appear in footer and nowhere else, do not consider as dedicated section.
        const outsideFooterText = bodyText.replace(footerText, '');
        const outsideHasCore = /\bmandate\b|\bmission\b|\bvision\b/.test(outsideFooterText);
        if (!outsideHasCore) {
          inAbout = false;
        }
      }

      return {
        hasBoth,
        inAbout,
      };
    });

    hasMandateMission = Boolean(aboutMeta?.hasBoth);
    mandateMissionInAboutSection = Boolean(aboutMeta?.inAbout);
  } catch {
    // ignore
  }

  return {
    pstFound,
    pstInMasthead,
    // If either detector finds a usable home affordance, treat as present.
    logoLinksHome: logoLinksHome || homeLinkFound,
    transparencySealLinked,
    breadcrumbEnabled,
    hasAbout,
    aboutMatchedText,
    hasContact,
    govphTopMenu,
    govphIsFirstTopMenu,
    standardFooterHasAgencyLinks,
    sitemapFound,
    sitemapXmlOnly,
    hasMandateMission,
    mandateMissionInAboutSection,
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
