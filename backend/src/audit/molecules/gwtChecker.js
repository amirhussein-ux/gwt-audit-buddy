function normalizeCheck(check) {
  const allowed = new Set(['Pass', 'Fail', 'N/A']);
  // Allow callers to signal that the primary presence condition was met
  // (Priority 1). When `primaryPresent` is true the canonical `status`
  // MUST be `Pass` even when secondary checks fail; secondary failures
  // are captured in `remarks` instead.
  let status = allowed.has(check.status) ? check.status : 'Fail';
  if (check.primaryPresent === true) {
    status = 'Pass';
  }

  return {
    key: check.key,
    category: check.category,
    item: check.item,
    status,
    remarks: check.remarks,
  };
}

// Unify detection logic with the audit engine.
// Why: duplicated heuristics across files are a major source of false negatives.
const { inspectPageSignals } = require('../atoms/pageSignals');

function buildPerformanceCheckFromTrials(trials) {
  const valid = trials.filter((value) => Number.isFinite(value));
  const failedCount = trials.length - valid.length;

  if (valid.length === 0) {
    return normalizeCheck({
      key: 'performance.avg_load_time',
      category: 'Performance',
      item: 'Average page load time across 3 trials is 10 seconds or less',
      status: 'Fail',
      remarks: 'All 3 performance trials failed due to timeout or navigation errors.',
    });
  }

  const averageMs = Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
  const passed = averageMs <= 10000 && failedCount === 0;

  return normalizeCheck({
    key: 'performance.avg_load_time',
    category: 'Performance',
    item: 'Average page load time across 3 trials is 10 seconds or less',
    status: passed ? 'Pass' : 'Fail',
    remarks: `Trials (ms): ${trials.map((value) => (Number.isFinite(value) ? value : 'timeout')).join(', ')}. Average: ${averageMs} ms.${failedCount > 0 ? ` Failed trials: ${failedCount}.` : ''}`,
  });
}

function findViolation(violations, ids) {
  return violations.find((violation) => ids.includes(violation.id));
}

function sumNodeCount(violation) {
  if (!violation || !Array.isArray(violation.nodes)) {
    return 0;
  }

  return violation.nodes.length;
}

function buildAccessibilityChecks(axeResults, nonDescriptiveLinkCount) {
  const violations = axeResults?.violations ?? [];
  const imageAltViolation = findViolation(violations, ['image-alt', 'input-image-alt', 'area-alt']);
  const colorContrastViolation = findViolation(violations, ['color-contrast']);
  const labelViolation = findViolation(violations, ['label', 'form-field-multiple-labels', 'aria-input-field-name']);

  const imageAltCount = sumNodeCount(imageAltViolation);
  const contrastCount = sumNodeCount(colorContrastViolation);
  const labelCount = sumNodeCount(labelViolation);

  return [
    normalizeCheck({
      key: 'a11y.image_alt',
      category: 'Technical Accessibility',
      item: 'Image alternative text checks (H.1, H.2, H.3)',
      status: imageAltCount > 0 ? 'Fail' : 'Pass',
      remarks: imageAltCount > 0
        ? `Failed: Found ${imageAltCount} image ALT-related issue(s) from Axe.`
        : 'Passed: No image ALT-related Axe violations found.',
    }),
    normalizeCheck({
      key: 'a11y.color_contrast',
      category: 'Technical Accessibility',
      item: 'Color contrast checks (C.1, C.2)',
      status: contrastCount > 0 ? 'Fail' : 'Pass',
      remarks: contrastCount > 0
        ? `Failed: Found ${contrastCount} color contrast issue(s) from Axe.`
        : 'Passed: No Axe color contrast violations found.',
    }),
    normalizeCheck({
      key: 'a11y.form_labels',
      category: 'Technical Accessibility',
      item: 'Form inputs have associated labels (H.6)',
      status: labelCount > 0 ? 'Fail' : 'Pass',
      remarks: labelCount > 0
        ? `Failed: Found ${labelCount} input labeling issue(s) from Axe.`
        : 'Passed: No input labeling violations from Axe.',
    }),
    normalizeCheck({
      key: 'a11y.descriptive_links',
      category: 'Technical Accessibility',
      item: 'Avoid non-descriptive links like "Click Here" (B.10)',
      status: nonDescriptiveLinkCount > 0 ? 'Fail' : 'Pass',
      remarks: nonDescriptiveLinkCount > 0
        ? `Failed: Found ${nonDescriptiveLinkCount} non-descriptive link(s) such as "click here".`
        : 'Passed: No non-descriptive links detected.',
    }),
  ];
}

async function buildPresenceIdentityChecks(page, targetOrigin) {
  // Core signals come from the shared inspector.
  // This ensures the checks here match what runAudit() uses.
  const signals = await inspectPageSignals(page, targetOrigin);
  const snapshot = await page.evaluate(() => {
    // broaden transparency-seal detection: check any <img> alt/title that matches transparency.*seal
    const transparencyRegex = /transparency.*seal/i;
    const transparencyImage = Array.from(document.querySelectorAll('img')).find((img) => {
      const alt = (img.getAttribute('alt') || '') || '';
      const title = (img.getAttribute('title') || '') || '';
      return transparencyRegex.test(alt) || transparencyRegex.test(title);
    });
    const transparencyHref = transparencyImage?.closest('a')?.getAttribute('href') || null;

    return {
      transparencyHref,
    };
  });

  // Determine homepage heuristics for PST messaging
  const urlObj = new URL(page.url());
  const path = (urlObj.pathname || '/').replace(/\/+$/, '').toLowerCase();
  const homepagePaths = new Set(['', '/', '/index.html', '/index.php', '/home', '/home-page', '/homepage']);
  const isHome = homepagePaths.has(path) || path === '';

  // Primary presence detections
  const pstPresent = Boolean(signals.pstFound) || await page.evaluate(() => !!document.querySelector('#pst-container, .pst-time, [id*="pst" i], [class*="pst" i]'));
  const pstInMasthead = pstPresent && await page.evaluate(() => {
    const el = document.querySelector('#pst-container, .pst-time, [id*="pst" i], [class*="pst" i]');
    return !!(el && el.closest && el.closest('header, [role="banner"], .masthead'));
  });

  const logoLinksHome = Boolean(signals.logoLinksHome);
  const transparencyPresent = Boolean(snapshot.transparencyHref) || await page.evaluate(() => {
    const img = document.querySelector('img[alt*="transparency" i], img[src*="transparency" i], img[title*="transparency" i]');
    return !!img;
  });

  const hasGov = Boolean(signals.govphTopMenu);
  const govIsFirst = Boolean(signals.govphIsFirstTopMenu);
  const govCheck = normalizeCheck({
    key: 'presence.govph_link',
    category: 'Presence & Identity',
    item: 'GovPH link exists in top menu',
    status: hasGov ? 'Pass' : 'Fail',
    primaryPresent: hasGov === true,
    remarks: hasGov
      ? (govIsFirst
        ? 'Pass: GovPH link found and placed as first top-menu element.'
        : 'Pass: GovPH link found, but it is not the first element in the top menu')
      : 'No gov.ph link found in top menu.',
  });

  return [
    normalizeCheck({
      key: 'navigation.home_link',
      category: 'Navigation',
      item: 'Home link is easy to find at top (masthead)',
      status: logoLinksHome ? 'Pass' : 'Fail',
      primaryPresent: logoLinksHome === true,
      remarks: logoLinksHome
        ? 'Home affordance detected via unified heuristics.'
        : 'Home affordance not detected via unified heuristics.',
    }),
    normalizeCheck({
      key: 'presence.pst',
      category: 'Presence & Identity',
      item: 'PST element present (#pst-container, .pst-time, or equivalent masthead text)',
      // Primary: presence anywhere -> Pass. Secondary: placement in masthead / across pages.
      status: pstPresent ? 'Pass' : 'Fail',
      primaryPresent: pstPresent === true,
      remarks: pstPresent
        ? (isHome
          ? (pstInMasthead
            ? 'Pass: PST present on homepage masthead.'
            : 'Pass: PST present on home, but GWT requires placement on all pages')
          : (pstInMasthead
            ? 'Pass: PST present in masthead.'
            : 'Pass: PST present but not in masthead (GWT recommends masthead placement)'))
        : 'PST element/text not detected.',
    }),
    normalizeCheck({
      key: 'presence.logo_home',
      category: 'Presence & Identity',
      item: 'Logo is in masthead and links to homepage',
      status: logoLinksHome ? 'Pass' : 'Fail',
      primaryPresent: logoLinksHome === true,
      remarks: logoLinksHome
        ? 'Logo/home link detected via unified heuristics.'
        : 'Logo link to homepage not detected in masthead.',
    }),
    normalizeCheck({
      key: 'presence.transparency_seal_link',
      category: 'Presence & Identity',
      item: 'Transparency Seal image exists and has a link',
      status: transparencyPresent ? 'Pass' : 'Fail',
      primaryPresent: transparencyPresent === true,
      remarks: transparencyPresent
        ? (snapshot.transparencyHref
          ? `Pass: Transparency Seal image found. Linked to: ${snapshot.transparencyHref}`
          : 'Pass: Transparency Seal image found but it is not linked. GWT recommends linking the seal to the Transparency Page.')
        : 'Transparency Seal image/link not found on page.',
    }),
    normalizeCheck({
      key: 'presence.breadcrumbs',
      category: 'Presence & Identity',
      item: 'Breadcrumb navigation is enabled',
      status: signals.breadcrumbEnabled ? 'Pass' : 'Fail',
      primaryPresent: signals.breadcrumbEnabled === true,
      remarks: signals.breadcrumbEnabled ? 'Breadcrumb component detected.' : 'Breadcrumb component not detected.',
    }),
    govCheck,
  ];
}

function isHomepageHref(href, origin) {
  if (!href || href === '#') {
    return false;
  }

  if (href.startsWith('/')) {
    return href === '/' || href.toLowerCase() === '/index.html';
  }

  try {
    const resolved = new URL(href, origin);
    const path = resolved.pathname.toLowerCase();
    return resolved.origin === origin && (path === '/' || path === '/index.html');
  } catch {
    return false;
  }
}

async function countNonDescriptiveLinks(page) {
  return page.evaluate(() => {
    const badPatterns = [/^click here$/i, /^here$/i, /^read more$/i, /^more$/i, /^learn more$/i];
    const anchors = Array.from(document.querySelectorAll('a'));
    return anchors.filter((anchor) => {
      const text = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
      return badPatterns.some((pattern) => pattern.test(text));
    }).length;
  });
}

async function buildTopNavigationChecks(page) {
  // Reuse the shared signals rather than duplicating heuristics here.
  const origin = new URL(page.url()).origin;
  const signals = await inspectPageSignals(page, origin);

  return [
    normalizeCheck({
      key: 'navigation.about_link',
      category: 'Navigation',
      item: 'About Us link is easy to find at top (masthead)',
      status: signals.hasAbout ? 'Pass' : 'Fail',
      remarks: signals.hasAbout
        ? 'About link detected via unified heuristics.'
        : 'About link not detected via unified heuristics.',
    }),
    normalizeCheck({
      key: 'navigation.contact_link',
      category: 'Navigation',
      item: 'Contact Us link is easy to find at top (masthead)',
      status: signals.hasContact ? 'Pass' : 'Fail',
      remarks: signals.hasContact
        ? 'Contact link detected via unified heuristics.'
        : 'Contact link not detected via unified heuristics.',
    }),
  ];
}

function buildCustom404Check(responseStatus, sameOrigin, pageTitle, bodySnippet, hasMasthead = false, hasFooter = false) {
  const looks404 = /404|not found|page not found/i.test(`${pageTitle} ${bodySnippet}`);
  const themeMaintained = hasMasthead && hasFooter;
  const passed = sameOrigin && looks404 && themeMaintained;

  return normalizeCheck({
    key: 'error.custom_404',
    category: 'Error Handling',
    item: 'Custom 404 page is returned for invalid path',
    status: passed ? 'Pass' : 'Fail',
    remarks: `Status: ${responseStatus ?? 'n/a'}, same-origin: ${sameOrigin}, not-found markers: ${looks404}, masthead: ${hasMasthead}, footer: ${hasFooter}.`,
  });
}

// Content and structure checks
async function buildContentAccessibilityChecks(page) {
  const results = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, title'));
    const hasDescriptiveHeadings = titles.some(h => (h.textContent || '').trim().length > 5);
    
    const metaTags = Array.from(document.querySelectorAll('meta[name], meta[property]'));
    // Consider OpenGraph tags (og:title, og:description) as valid metadata
    const ogTitle = metaTags.find(m => (m.getAttribute('property') || '').toLowerCase() === 'og:title');
    const ogDescription = metaTags.find(m => (m.getAttribute('property') || '').toLowerCase() === 'og:description');
    const hasMeta = metaTags.some(m => (m.getAttribute('content') || '').length > 10) || Boolean(ogTitle) || Boolean(ogDescription);
    
    const anchors = Array.from(document.querySelectorAll('a'));
    const urls = anchors.map(a => (a.getAttribute('href') || '').toLowerCase());
    const hasDescriptiveUrls = urls.some(url => url.length > 0 && !url.includes('?') && url !== '#');
    
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const hasContent = bodyText.length > 300;

    const textNodes = Array.from(document.querySelectorAll('p, li, td, dd, .content, [role="main"], [class*="col-md-"], .main-content, .container'));
    const hasStructuredText = textNodes.length > 5;
    
    return {
      hasDescriptiveHeadings,
      hasMeta,
      hasDescriptiveUrls,
      hasContent,
      hasStructuredText,
      bodyLength: bodyText.length,
    };
  });

  return [
    normalizeCheck({
      key: 'content.headings_descriptive',
      category: 'Content',
      item: 'Title tags are descriptive',
      status: results.hasDescriptiveHeadings ? 'Pass' : 'Fail',
      remarks: results.hasDescriptiveHeadings ? 'Descriptive headings/titles detected.' : 'Headings/titles appear generic or missing.',
    }),
    normalizeCheck({
      key: 'content.meta_descriptive',
      category: 'Content',
      item: 'Meta descriptions are descriptive',
      status: results.hasMeta ? 'Pass' : 'Fail',
      remarks: results.hasMeta ? 'Meta tags with content detected.' : 'Meta descriptions missing or empty.',
    }),
    normalizeCheck({
      key: 'content.urls_descriptive',
      category: 'Content',
      item: 'URLs are descriptive',
      status: results.hasDescriptiveUrls ? 'Pass' : 'Fail',
      remarks: results.hasDescriptiveUrls ? 'Descriptive URL paths detected.' : 'URLs appear to be auto-generated or non-descriptive.',
    }),
    normalizeCheck({
      key: 'content.relevance_detail',
      category: 'Content',
      item: 'Content is sufficiently relevant and detailed',
      status: results.hasContent ? 'Pass' : 'Fail',
      remarks: results.hasContent ? `Page has ${results.bodyLength} characters of content.` : 'Page content appears minimal or sparse.',
    }),
    normalizeCheck({
      key: 'content.text_readability',
      category: 'Content',
      item: 'Text is easy to read',
      status: results.hasStructuredText ? 'Pass' : 'Fail',
      remarks: results.hasStructuredText ? `Found ${results.textNodes?.length || 0} text containers with structured formatting.` : 'Page lacks structured text (paragraphs, lists, etc.).',
    }),
  ];
}

async function buildNavigationStructureChecks(page, targetOrigin) {
  const results = await page.evaluate(() => {
    // More flexible navigation detection - look for various structures
    const navElements = document.querySelectorAll('nav, [role="navigation"], header, [class*="nav"], [class*="menu"], .navbar, .topnav');
    // Detect containers that have multiple horizontal links even without explicit nav semantics
    const potentialNavContainers = Array.from(document.querySelectorAll('header, .navbar, .topnav, .menu, [class*="nav"], [class*="menu"]'));
    const hasHorizontalLinkContainer = potentialNavContainers.some(el => el.querySelectorAll('a').length > 4);
    const hasNav = navElements.length > 0 || hasHorizontalLinkContainer || document.querySelectorAll('a').length > 5; // If 5+ links, likely has navigation
    
    // Sitemap detection
    const hasSitemap = /sitemap|site\s*map/i.test(document.body?.innerText || '');
    
    // Search detection - multiple selectors including ID-based custom search implementations
    const searchSelectors = ['input[type="search"]', 'input[type="text"][placeholder*="search" i]', 'input[id*="search" i]', 'button[id*="search" i]', '.search', '[role="search"]', '[class*="search"]', 'form[action*="search"]'];
    let hasSearch = false;
    for (const selector of searchSelectors) {
      if (document.querySelector(selector)) {
        hasSearch = true;
        break;
      }
    }
    
    // Breadcrumbs detection
    const breadcrumbs = Boolean(document.querySelector('nav[aria-label*="breadcrumb" i], .breadcrumb, ol.breadcrumb, ul.breadcrumb, [class*="breadcrumb"]'));
    
    // Back/home navigation detection
    const allLinks = Array.from(document.querySelectorAll('a'));
    const backToHomeLinks = allLinks.filter(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      const text = (a.textContent || '').toLowerCase().trim();
      // More flexible matching
      return href === '/' || href === '/index.html' || href === '/index.php' || href.endsWith('/') || 
             text === 'home' || text === 'back' || text.includes('go home') || href.includes('home');
    });
    
    return {
      hasNav,
      hasSitemap,
      hasSearch,
      breadcrumbs,
      backToHomeLinks: backToHomeLinks.length > 0,
    };
  });

  return [
    normalizeCheck({
      key: 'navigation.scheme_consistency',
      category: 'Navigation',
      item: 'Navigation scheme is easy to find and consistent',
      status: results.hasNav ? 'Pass' : 'Fail',
      remarks: results.hasNav ? 'Navigation elements detected.' : 'No navigation structure found.',
    }),
    normalizeCheck({
      key: 'navigation.sitemap_structure',
      category: 'Navigation',
      item: 'Sitemap or clear structure index is provided',
      status: results.hasSitemap || results.hasSearch ? 'Pass' : 'Fail',
      remarks: results.hasSitemap ? 'Sitemap reference found.' : results.hasSearch ? 'Search function available.' : 'No sitemap or search found.',
    }),
    normalizeCheck({
      key: 'navigation.back_start_point',
      category: 'Navigation',
      item: 'Users can easily get back to homepage or start point',
      status: results.backToHomeLinks ? 'Pass' : 'Fail',
      remarks: results.backToHomeLinks ? 'Home/back links detected.' : 'No obvious home/back navigation.',
    }),
  ];
}

async function buildBrandIdentityChecks(page) {
  const results = await page.evaluate(() => {
    // More flexible logo detection
    const logoSelectors = ['img[alt*="logo" i]', 'img[src*="logo" i]', '[class*="logo" i] img', '.brand-logo', '.org-logo', 'header img', '[role="banner"] img', '.agency-logo', '.navbar-brand', '.logo-container img'];
    let logos = [];
    for (const selector of logoSelectors) {
      logos = logos.concat(Array.from(document.querySelectorAll(selector)));
    }
    // Remove duplicates
    logos = Array.from(new Set(logos));
    
    const logoAtTop = logos.some(l => {
      try {
        const rect = l.getBoundingClientRect();
        return rect.top < 300 && rect.top >= -100 && rect.height > 20;
      } catch {
        return false;
      }
    });

    // Tagline detection - more flexible
    const taglineSelectors = ['h1', 'h2', '.tagline', '.subtitle', '.slogan', '[role="banner"] p', 'header p', '.institution-purpose', '[class*="tagline"]'];
    let taglines = [];
    for (const selector of taglineSelectors) {
      taglines = taglines.concat(Array.from(document.querySelectorAll(selector)));
    }
    const hasTagline = taglines.some(h => (h.textContent || '').trim().length > 10);

    // Content above fold
    const foldHeight = window.innerHeight;
    const criticalSelectors = ['h1', '.hero', '.featured', '[role="main"]', 'header', '.main-content', '.banner'];
    let criticalElements = [];
    for (const selector of criticalSelectors) {
      criticalElements = criticalElements.concat(Array.from(document.querySelectorAll(selector)));
    }
    const contentAboveFold = criticalElements.filter(el => {
      try {
        const rect = el.getBoundingClientRect();
        return rect.top < foldHeight && rect.bottom > 0 && (rect.height > 20 || el.textContent?.length > 10);
      } catch {
        return false;
      }
    }).length > 0;

    return {
      logoAtTop,
      hasTagline,
      contentAboveFold,
      logoCount: logos.length,
    };
  });

  return [
    normalizeCheck({
      key: 'identity.logo_featured',
      category: 'Brand Identity',
      item: 'Logo is easy to find (located on top of page)',
      status: results.logoAtTop ? 'Pass' : 'Fail',
      remarks: results.logoAtTop ? `Logo found in top region of page (${results.logoCount} logos detected).` : `Logo not detected or positioned below fold (${results.logoCount} total logos).`,
    }),
    normalizeCheck({
      key: 'identity.tagline_purpose',
      category: 'Brand Identity',
      item: 'Tagline clearly states institution purpose',
      status: results.hasTagline ? 'Pass' : 'Fail',
      remarks: results.hasTagline ? 'Tagline/subtitle text detected.' : 'No clear tagline or institution purpose statement.',
    }),
    normalizeCheck({
      key: 'content.critical_above_fold_line',
      category: 'Content',
      item: 'Critical content is above the fold',
      status: results.contentAboveFold ? 'Pass' : 'Fail',
      remarks: results.contentAboveFold ? 'Main content/heading detected above fold.' : 'No critical content visible above fold.',
    }),
  ];
}

async function buildCompanyInfoChecks(page) {
  const results = await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const bodyHtml = (document.body?.innerHTML || '').toLowerCase();
    const allLinks = Array.from(document.querySelectorAll('a'));
    
    // About Us: check for text and links
    // Basic about detection
    let hasAbout = /about\s*us|who\s*we\s*are|company\s*profile|about\s*the|institutional|organisation/.test(bodyText + bodyHtml) || 
                    allLinks.some(a => /about|who\s*we\s*are|company\s*profile|institutional/i.test(a.textContent));

    // Identity-aware detection: if page title contains a city/agency name, look for "About [CityName]"
    let aboutMatchedText = null;
    try {
      const title = document.title || '';
      const cityMatch = title.match(/([A-Za-z\s]+?)\s+(City|Province|Municipality|Municipal|Town|City\s+Government|Government)/i);
      const cityName = cityMatch ? cityMatch[1].trim() : null;
      if (cityName) {
        const esc = cityName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        const aboutCityRe = new RegExp('about\\s+' + esc, 'i');
        if (aboutCityRe.test(bodyText) || allLinks.some(a => aboutCityRe.test((a.textContent || '') + ' ' + (a.getAttribute('href') || '')))) {
          hasAbout = true;
          aboutMatchedText = `About ${cityName}`;
        }
      }
    } catch (e) {
      // ignore
    }
    
    // Organization structure: look for org chart, structure, or relevant text
    const hasOrgStructure = /organization|structure|hierarchy|division|office|bureau|department|services?(s)?|unit|branch/i.test(bodyText) ||
                           document.querySelector('[class*="org"], table, .structure') !== null;
    
    // Key officials: officer, director, head, management, team, leadership
    const hasOfficials = /official|director|head|chief|officer|mayor|governor|president|management|team|leadership|cabinet/.test(bodyText) ||
                        allLinks.some(a => /official|director|head|officer|leadership|management|team/i.test(a.textContent));
    
    // News/press releases
    const hasNews = /news|press|release|announcement|blog|update|publication|advisory|alert/i.test(bodyText + bodyHtml) ||
                   allLinks.some(a => /news|press|blog|announce|publication/i.test(a.textContent));
    
    // Transparency
    const hasTransparency = /transparency|seal|disclosure|disclosur|rtinformation|aum|audit|financial statement|budget|report/i.test(bodyText + bodyHtml) ||
                           document.querySelector('img[src*="transparency"], img[alt*="seal" i], img[src*="seal"]') !== null;
    
    // Citizens Charter / Service Standards
    const hasCharter = /charter|service\s*standard|customer\s*care|commitments?|guarantee|promise/i.test(bodyText);
    
    // Mission and Vision - look for headings and structured sections
    const missionInHeading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).some(h => /mission|vision/i.test(h.textContent || ''));
    const missionInClass = Array.from(document.querySelectorAll('[class*="mission" i], [class*="vision" i]')).length > 0;
    const hasMissionHeading = /\bmission\b|\bvision\b/i.test(bodyText);
    const hasMissionContent = /mission|vision|purpose|goals?|objective|aspiration|commitment/i.test(bodyText);
    const hasMission = missionInHeading || missionInClass || hasMissionHeading || hasMissionContent;
    
    // Mandate and Functions - more flexible detection for government agencies
    const mandateInHeading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).some(h => /mandate|functions?|responsibilit/i.test(h.textContent || ''));
    const hasMandateText = /mandate|function|responsibilit|authority|power|jurisdiction|legal.basis|authority|enabling.law/i.test(bodyText);
    const hasMandate = mandateInHeading || hasMandateText || hasMission; // If mission/vision present, mandate often nearby
    
    // Products or Services
    const hasProducts = /product|service|program|project|offering|initiative|scheme|benefit|application/i.test(bodyText);
    
    return {
      hasAbout,
      aboutMatchedText,
      hasOrgStructure,
      hasOfficials,
      hasNews,
      hasTransparency,
      hasCharter,
      hasMission,
      hasMandate,
      hasProducts,
    };
  });

  // Determine if current page is homepage for prominence checks
  const urlObj = new URL(page.url());
  const path = (urlObj.pathname || '/').replace(/\/+$/, '').toLowerCase();
  const homepagePaths = new Set(['', '/', '/index.html', '/index.php', '/home', '/home-page', '/homepage']);
  const isHome = homepagePaths.has(path) || path === '';

  // Check news prominence on frontpage (secondary requirement)
  const newsProminent = isHome && await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('h1, h2, h3')).find(h => /news|press|announcement|advisory|release/i.test(h.textContent || ''));
    if (heading) {
      try { return heading.getBoundingClientRect().top < window.innerHeight; } catch { return false; }
    }
    const section = document.querySelector('.news, .press-release, [id*="news" i], [class*="news" i]');
    if (section) {
      try { return section.getBoundingClientRect().top < window.innerHeight; } catch { return false; }
    }
    return false;
  });

  // Detect Citizens' Charter link and whether it is a PDF-only resource
  const charterLink = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const candidate = anchors.find(a => /citizen'??s?\s*charter|service\s*standard|service\s*standards|citizens\s*charter/i.test(a.textContent || '') || /charter|service-standard|citizen/i.test(a.href));
    if (!candidate) return null;
    const href = candidate.getAttribute('href') || '';
    return { href, isPdf: /\.pdf(\?|$)/i.test(href) };
  });
  // Build citizens' charter normalized check synchronously
  let charterCheck;
  if (!charterLink) {
    charterCheck = normalizeCheck({
      key: 'presence.citizens_charter',
      category: 'Presence & Identity',
      item: "Citizens Charter is documented",
      status: 'Fail',
      remarks: 'No Citizens Charter resource found.',
    });
  } else if (charterLink.isPdf) {
    charterCheck = normalizeCheck({
      key: 'presence.citizens_charter',
      category: 'Presence & Identity',
      item: "Citizens Charter is documented",
      status: 'Fail',
      primaryPresent: false,
      remarks: "Fail: Citizen's Charter found but is not readable by screen readers (Scanned PDF)",
    });
  } else {
    charterCheck = normalizeCheck({
      key: 'presence.citizens_charter',
      category: 'Presence & Identity',
      item: "Citizens Charter is documented",
      status: 'Pass',
      primaryPresent: true,
      remarks: 'Pass: Citizens Charter accessible (HTML/text resource detected).',
    });
  }

  return [
    normalizeCheck({
      key: 'company_info.about_link',
      category: 'Company Information',
      item: 'About Us is easy to find',
      status: results.hasAbout ? 'Pass' : 'Fail',
      remarks: results.hasAbout
        ? (results.aboutMatchedText
          ? `Pass: About section detected via fuzzy match ('${results.aboutMatchedText}')`
          : 'About/Company information detected.')
        : 'No About Us section found.',
    }),
    normalizeCheck({
      key: 'presence.organization_structure',
      category: 'Presence & Identity',
      item: 'Organization structure is documented',
      status: results.hasOrgStructure ? 'Pass' : 'Fail',
      remarks: results.hasOrgStructure ? 'Organization structure information detected.' : 'No organization structure documentation.',
    }),
    normalizeCheck({
      key: 'presence.key_officials',
      category: 'Presence & Identity',
      item: 'Key officials information is provided',
      status: results.hasOfficials ? 'Pass' : 'Fail',
      remarks: results.hasOfficials ? 'Official/management team information detected.' : 'No key officials listed.',
    }),
    normalizeCheck({
      key: 'content.news_releases',
      category: 'Content',
      item: 'News/press releases/announcements are present',
      // Primary: news exists anywhere -> Pass. Secondary: on homepage, must be prominent.
      status: results.hasNews ? 'Pass' : 'Fail',
      primaryPresent: results.hasNews === true,
      remarks: results.hasNews
        ? (isHome && !newsProminent
          ? 'Pass: News found, but not prominently placed on frontpage.'
          : 'Pass: News/press/blog section detected.')
        : 'No news or announcements section.',
    }),
    normalizeCheck({
      key: 'presence.transparency_seal',
      category: 'Presence & Identity',
      item: 'Transparency information is available',
      status: results.hasTransparency ? 'Pass' : 'Fail',
      remarks: results.hasTransparency ? 'Transparency/disclosure information found.' : 'No transparency documentation.',
    }),
    charterCheck,
    normalizeCheck({
      key: 'presence.mission_vision',
      category: 'Presence & Identity',
      item: 'Mission and Vision statements are documented',
      status: results.hasMission ? 'Pass' : 'Fail',
      remarks: results.hasMission ? 'Mission/Vision statements found.' : 'No mission or vision statement.',
    }),
    normalizeCheck({
      key: 'presence.mandate_functions',
      category: 'Presence & Identity',
      item: 'Mandate and Functions are documented',
      status: results.hasMandate ? 'Pass' : 'Fail',
      remarks: results.hasMandate ? 'Mandate/functions information detected.' : 'No documented mandate or functions.',
    }),
    normalizeCheck({
      key: 'presence.products_services',
      category: 'Presence & Identity',
      item: 'Products or Services are documented',
      status: results.hasProducts ? 'Pass' : 'Fail',
      remarks: results.hasProducts ? 'Services/products information found.' : 'No documented products or services.',
    }),
  ];
}

async function buildContactInfoChecks(page) {
  const results = await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '');
    const bodyHtml = (document.body?.innerHTML || '');
    
    // Phone detection - multiple formats and patterns
    const hasPhone = /\b(?:\+?(?:63|1)\s?)?(?:\(?0?9\d{2}\)?|02)\s?[-.\s]?\d{3}[-.\s]?\d{4}\b|phone|tel\s*:|telephone|mobile\s*:|\+63/i.test(bodyText + bodyHtml);
    
    // Fax detection
    const hasFax = /fax|facsimile/i.test(bodyText);
    
    // Email detection - look for mailto links or email patterns
    const hasEmail = /@|email|e-mail/i.test(bodyText + bodyHtml) || document.querySelector('a[href^="mailto:"]') !== null;
    
    // Mobile/cellphone detection
    const hasMobile = /mobile|cellphone|cell\s*phone|viber|whatsapp|\+63\s?9|\(09|\b0\d{2}\b/i.test(bodyText);
    
    // Address detection - look for structured text or patterns
    const hasAddress = /street|address|city|province|avenue|road|blvd|lot\s*\d+|building|floor|\d+\s*(?:st|nd|rd|th)|makati|manila|ncr|bgc/i.test(bodyText);
    
    // Social networks - look for links or text references
    const socialLinks = Array.from(document.querySelectorAll('a[href*="facebook"], a[href*="twitter"], a[href*="instagram"], a[href*="youtube"], a[href*="linkedin"]'));
    const socialText = /facebook|twitter|linkedin|instagram|youtube|tiktok|tik-tok|pinterest/i.test(bodyText);
    const hasSocial = socialLinks.length > 0 || socialText;
    
    // Feedback form - look for form elements or feedback links
    const hasFeedback = /feedback|contact\s*us|contact\s*form|comment|suggestion/i.test(bodyText + bodyHtml) || document.querySelector('form, textarea, input[type="email"]') !== null;
    
    return {
      hasPhone,
      hasFax,
      hasEmail,
      hasMobile,
      hasAddress,
      hasSocial,
      hasFeedback,
    };
  });

  return [
    normalizeCheck({
      key: 'contact_info.phone',
      category: 'Contact Information',
      item: 'Telephone number is provided',
      status: results.hasPhone ? 'Pass' : 'Fail',
      remarks: results.hasPhone ? 'Phone/contact number found on page.' : 'No phone contact information.',
    }),
    normalizeCheck({
      key: 'contact_info.fax',
      category: 'Contact Information',
      item: 'Fax number is provided',
      status: results.hasFax ? 'Pass' : 'Fail',
      remarks: results.hasFax ? 'Fax information detected.' : 'No fax contact info.',
    }),
    normalizeCheck({
      key: 'contact_info.mobile',
      category: 'Contact Information',
      item: 'Mobile number is provided',
      status: results.hasMobile ? 'Pass' : 'Fail',
      remarks: results.hasMobile ? 'Mobile/cellphone contact found.' : 'No mobile contact.',
    }),
    normalizeCheck({
      key: 'contact_info.email',
      category: 'Contact Information',
      item: 'Email address is provided',
      status: results.hasEmail ? 'Pass' : 'Fail',
      remarks: results.hasEmail ? 'Email address detected.' : 'No email contact provided.',
    }),
    normalizeCheck({
      key: 'presence.contact_details',
      category: 'Presence & Identity',
      item: 'Contact details (phone/fax/email/address) provided',
      status: (results.hasPhone || results.hasEmail) && results.hasAddress ? 'Pass' : 'Fail',
      remarks: `Found: phone=${results.hasPhone}, email=${results.hasEmail}, address=${results.hasAddress}`,
    }),
    normalizeCheck({
      key: 'contact_info.social_networks',
      category: 'Contact Information',
      item: 'Social networking sites are linked',
      status: results.hasSocial ? 'Pass' : 'Fail',
      remarks: results.hasSocial ? 'Social media links detected.' : 'No social media links found.',
    }),
    normalizeCheck({
      key: 'contact_info.feedback_form',
      category: 'Contact Information',
      item: 'Feedback form is provided',
      status: results.hasFeedback ? 'Pass' : 'Fail',
      remarks: results.hasFeedback ? 'Feedback/contact form detected.' : 'No feedback form found.',
    }),
  ];
}

async function buildWebPresenceStageChecks(page) {
  const results = await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const hasDownloads = /download|file|document|resource/.test(bodyText);
    const hasArchives = /archive|history|past|previous/.test(bodyText);
    const hasFaqs = /faq|question|answer|help/.test(bodyText);
    const hasEservices = /e-service|online service|application/.test(bodyText);
    const hasSearch = Boolean(document.querySelector('input[type="search"], .search'));
    const hasForms = document.querySelectorAll('form').length > 0;
    const hasRss = document.querySelector('link[rel="alternate"][type="application/rss"]') !== null;
    const hasVideo = document.querySelector('video, iframe[src*="youtube"]') !== null;
    const hasParticipation = /forum|survey|poll|feedback|discussion/.test(bodyText);
    
    return {
      hasDownloads,
      hasArchives,
      hasFaqs,
      hasEservices,
      hasSearch,
      hasForms,
      hasRss,
      hasVideo,
      hasParticipation,
    };
  });

  return [
    normalizeCheck({
      key: 'resources.downloads',
      category: 'Resources',
      item: 'Downloads section is available',
      status: results.hasDownloads ? 'Pass' : 'Fail',
      remarks: results.hasDownloads ? 'Downloads/resources section detected.' : 'No downloads or resources section.',
    }),
    normalizeCheck({
      key: 'resources.archives',
      category: 'Resources',
      item: 'Archives section is available',
      status: results.hasArchives ? 'Pass' : 'Fail',
      remarks: results.hasArchives ? 'Archive/historical information detected.' : 'No archives section.',
    }),
    normalizeCheck({
      key: 'resources.faqs',
      category: 'Resources',
      item: 'FAQs section is available',
      status: results.hasFaqs ? 'Pass' : 'Fail',
      remarks: results.hasFaqs ? 'FAQs or help section detected.' : 'No FAQs available.',
    }),
    normalizeCheck({
      key: 'services.eservices',
      category: 'eServices',
      item: 'e-Services are available',
      status: results.hasEservices ? 'Pass' : 'Fail',
      remarks: results.hasEservices ? 'Online services detected.' : 'No e-services offered.',
    }),
    normalizeCheck({
      key: 'features.search_sitemap',
      category: 'Features',
      item: 'Search function and sitemap are available',
      status: results.hasSearch ? 'Pass' : 'Fail',
      remarks: results.hasSearch ? 'Search functionality detected.' : 'No search function found.',
    }),
    normalizeCheck({
      key: 'features.online_forms',
      category: 'Features',
      item: 'Online forms are available',
      status: results.hasForms ? 'Pass' : 'Fail',
      remarks: results.hasForms ? `Forms detected.` : 'No online forms.',
    }),
    normalizeCheck({
      key: 'participation.rss',
      category: 'eParticipation',
      item: 'RSS feed is available',
      status: results.hasRss ? 'Pass' : 'Fail',
      remarks: results.hasRss ? 'RSS feed detected.' : 'No RSS feed available.',
    }),
    normalizeCheck({
      key: 'tools.webcasting',
      category: 'Participation Tools',
      item: 'Video/Webcasting is available',
      status: results.hasVideo ? 'Pass' : 'Fail',
      remarks: results.hasVideo ? 'Video content detected.' : 'No video webcasting.',
    }),
    normalizeCheck({
      key: 'tools.discussion_forums',
      category: 'Participation Tools',
      item: 'Discussion/Feedback mechanisms are available',
      status: results.hasParticipation ? 'Pass' : 'Fail',
      remarks: results.hasParticipation ? 'Participation mechanisms detected.' : 'No forums or feedback channels.',
    }),
  ];
}

// Content Quality & Text Analysis
async function buildContentQualityChecks(page) {
  const results = await page.evaluate(() => {
    const bodyText = document.body?.innerText || '';
    const bodyHtml = document.body?.innerHTML || '';
    
    // Terminology consistency: look for repeated key terms
    const words = bodyText.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const wordFreq = {};
    words.forEach(w => wordFreq[w] = (wordFreq[w] || 0) + 1);
    const hasRepeatedTerms = Object.values(wordFreq).some(count => count >= 5);
    
    // Language and tone: look for formal structure
    const hasBylines = /by:|author:|wrote|written|contact|address/i.test(bodyText);
    const hasStructuredContent = /\n.*\n.*\n/i.test(bodyText) && bodyText.length > 1000;
    
    // Font/spacing: compute average computed font-size for primary text elements
    const textSamples = Array.from(document.querySelectorAll('p, li, td, dd, body'));
    let avgFontPx = 0;
    if (textSamples.length > 0) {
      const sizes = textSamples.map((el) => {
        try {
          const fs = window.getComputedStyle(el).fontSize || '16px';
          return parseFloat(fs.replace('px', '')) || 16;
        } catch {
          return 16;
        }
      });
      avgFontPx = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    }
    // Convert px to pt at 96dpi: pt = px * 0.75
    const avgFontPt = Math.round((avgFontPx * 0.75) * 10) / 10;
    const hasCssTypography = avgFontPt > 0;
    
    // Flash and add-ons: check for plugin objects
    const hasFlash = document.querySelector('object[data*=".swf"], embed[src*=".swf"], object[type*="flash"]') !== null;
    const hasPlugins = document.querySelectorAll('object, embed, applet').length > 2;
    
    // Seizure-inducing content: look for animation/flashing elements
    const hasAnimations = /animation|keyframes|transition.*s|opacity.*0/i.test(document.querySelector('style')?.textContent || '');
    const hasFlashyContent = Array.from(document.querySelectorAll('[style*="animation"], [style*="transition"]')).length > 5;
    
    // Concise copy: measure average sentence length
    const sentences = bodyText.match(/[.!?]+/g) || [];
    const avgSentenceLength = sentences.length > 0 ? bodyText.length / sentences.length : 0;
    
    // Page title
    const pageTitle = document.title || '';
    const titleLength = pageTitle.length;
    
    return {
      hasRepeatedTerms,
      hasBylines,
      hasStructuredContent,
      hasCssTypography,
      avgFontPt,
      hasFlash,
      hasPlugins,
      hasAnimations,
      hasFlashyContent,
      avgSentenceLength,
      titleLength,
      bodyLength: bodyText.length,
    };
  });

  return [
    normalizeCheck({
      key: 'content.terminology_consistency',
      category: 'Content',
      item: 'Terms language and tone used are consistent',
      status: results.hasRepeatedTerms ? 'Pass' : 'Fail',
      remarks: results.hasRepeatedTerms ? 'Consistent terminology patterns detected.' : 'Terminology inconsistencies detected.',
    }),
    normalizeCheck({
      key: 'content.language_tone_appropriate',
      category: 'Content',
      item: 'Language terminology and tone is appropriate',
      status: (results.hasBylines || results.hasStructuredContent) ? 'Pass' : 'Fail',
      remarks: (results.hasBylines || results.hasStructuredContent) ? 'Structured and formal content detected.' : 'Content lacks formal structure.',
    }),
    normalizeCheck({
      key: 'content.legibility_contrast',
      category: 'Content',
      item: 'Text and content is legible with good contrast',
      status: results.hasCssTypography ? 'Pass' : 'Fail',
      remarks: results.hasCssTypography ? 'CSS typography rules detected.' : 'No explicit typography styling found.',
    }),
    normalizeCheck({
      key: 'content.font_spacing',
      category: 'Content',
      item: 'Font size/spacing is easy to read',
      status: (results.avgFontPt >= 12 && results.avgFontPt <= 14) ? 'Pass' : 'Fail',
      remarks: (results.avgFontPt > 0)
        ? `Average font size: ${results.avgFontPt}pt. Expected between 12pt and 14pt.`
        : 'Could not determine average font size.',
    }),
    normalizeCheck({
      key: 'content.flash_addons',
      category: 'Content',
      item: 'Flash & add-ons are used sparingly',
      status: !results.hasFlash && !results.hasPlugins ? 'Pass' : 'Fail',
      remarks: results.hasFlash ? 'Flash content detected.' : results.hasPlugins ? `${results.hasPlugins} plugins detected.` : 'No Flash or plugins detected.',
    }),
    normalizeCheck({
      key: 'content.no_seizure_content',
      category: 'Content',
      item: 'No page content flashes more than 3 times per second',
      status: !results.hasFlashyContent ? 'Pass' : 'Fail',
      remarks: results.hasFlashyContent ? 'Rapid animation/flashing detected.' : 'No excessive flashing detected.',
    }),
    normalizeCheck({
      key: 'content.no_excessive_flashing',
      category: 'Content',
      item: 'Page does not contain excessive flashing content',
      status: !results.hasAnimations ? 'Pass' : 'Fail',
      remarks: results.hasAnimations ? 'Animation effects detected.' : 'No excessive animations.',
    }),
    normalizeCheck({
      key: 'content.copy_concise',
      category: 'Content',
      item: 'Main copy is concise & explanatory',
      status: results.avgSentenceLength > 0 && results.avgSentenceLength < 100 ? 'Pass' : 'Fail',
      remarks: `Average sentence length: ${Math.round(results.avgSentenceLength)} chars. ${results.avgSentenceLength > 100 ? 'Sentences may be too long.' : 'Sentences appear concise.'}`,
    }),
    normalizeCheck({
      key: 'content.page_titles_explanatory',
      category: 'Content',
      item: 'HTML page titles are explanatory',
      status: results.titleLength > 10 && results.titleLength < 60 ? 'Pass' : 'Fail',
      remarks: results.titleLength === 0 ? 'No page title detected.' : `Page title length: ${results.titleLength} chars. ${results.titleLength < 10 ? 'Title too short.' : results.titleLength > 60 ? 'Title too long.' : 'Title length appropriate.'}`,
    }),
    normalizeCheck({
      key: 'content.information_uptodate',
      category: 'Content',
      item: 'Information/data is up to date',
      status: results.bodyLength > 500 ? 'Pass' : 'Fail',
      remarks: `Page content: ${results.bodyLength} chars. ${results.bodyLength > 500 ? 'Sufficient content detected.' : 'Content appears minimal.'}`,
    }),
  ];
}

// Browser Compatibility Checks
async function buildBrowserCompatibilityChecks(page) {
  const results = await page.evaluate(() => {
    // Count interactive elements
    const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], a[role="button"]');
    const links = document.querySelectorAll('a');
    const totalInteractive = buttons.length + links.length;
    const reasonableCount = totalInteractive > 3 && totalInteractive < 100;
    
    // Check for mobile-friendly viewport
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const hasViewportMeta = viewportMeta !== null;
    
    // Check CSS media queries for responsive design
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
    const hasMediaQueries = styles.some(style => {
      const content = style.textContent || '';
      return /@media/i.test(content);
    });
    
    // Check if key content is above fold without requiring scroll
    const viewportHeight = window.innerHeight;
    const mainContent = document.querySelector('main, [role="main"], .container, .content');
    const contentHeight = mainContent?.getBoundingClientRect().height || 0;
    const contentAccessibleWithoutScroll = contentHeight > 0 && contentHeight < viewportHeight * 1.5;
    
    return {
      reasonableCount,
      totalInteractive,
      hasViewportMeta,
      hasMediaQueries,
      contentAccessibleWithoutScroll,
    };
  });

  return [
    normalizeCheck({
      key: 'browser.standard_functions',
      category: 'Browser Compatibility',
      item: 'Number of buttons/links is reasonable',
      status: results.reasonableCount ? 'Pass' : 'Fail',
      remarks: `Total interactive elements: ${results.totalInteractive}. ${results.reasonableCount ? 'Count is reasonable.' : results.totalInteractive < 3 ? 'Too few interactive elements.' : 'Too many interactive elements.'}`,
    }),
    normalizeCheck({
      key: 'browser.mobile_viewability',
      category: 'Browser Compatibility',
      item: 'Important content is viewable on small screens without scrolling',
      status: results.hasViewportMeta && results.hasMediaQueries && results.contentAccessibleWithoutScroll ? 'Pass' : 'Fail',
      remarks: `Viewport meta: ${results.hasViewportMeta ? '✓' : '✗'}, Media queries: ${results.hasMediaQueries ? '✓' : '✗'}, Content accessible: ${results.contentAccessibleWithoutScroll ? '✓' : '✗'}`,
    }),
  ];
}

// Advanced Presence & Identity Checks
async function buildAdvancedPresenceChecks(page) {
  const results = await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const allLinks = Array.from(document.querySelectorAll('a'));
    
    // Improved home link detection - check both href and text
    const hasHome = allLinks.some(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      const text = (a.textContent || '').toLowerCase().trim();
      const hrefUrl = new URL(a.href, window.location.origin);
      const homePath = hrefUrl.pathname.toLowerCase();
      
      // Match if text contains "home"
      if (text === 'home' || text.includes('home')) return true;
      // Match if href is root or index
      if (href === '/' || href === '/index.html' || href === '/index.php' || href === '') return true;
      // Match if pathname is just / or /index
      if (homePath === '/' || homePath === '/index.html' || homePath === '/index.php') return true;
      
      return false;
    });
    
    return {
      hasHome,
      hasOrgObjectives: /objective|aim|goal|target|outcome/.test(bodyText),
      hasPlans: /plan|program|project|initiative|activity/.test(bodyText),
      hasPolicyReleases: /policy|regulation|guideline|ruling|directive|issuance|order/.test(bodyText),
      hasMajorOutputs: /output|deliverable|result|achievement|preac|budget|circular|report/.test(bodyText),
      hasOpportunities: /opportunity|career|job|vacancy|recruitment|tender|bid|rfp/.test(bodyText),
      hasAnnouncements: /announcement|news|event|alert|press release|advisory|notice/.test(bodyText),
      hasLatestNews: /latest|recent|new|update|breaking/.test(bodyText),
      isHeaderPresent: document.querySelector('header, [role="banner"]') !== null,
      isFooterPresent: document.querySelector('footer, [role="contentinfo"]') !== null,
    };
  });

  return [
    normalizeCheck({
      key: 'presence.home',
      category: 'Presence & Identity',
      item: 'Home link is present',
      status: results.hasHome ? 'Pass' : 'Fail',
      remarks: results.hasHome ? 'Home link detected.' : 'No home link found.',
    }),
    normalizeCheck({
      key: 'presence.org_objectives',
      category: 'Presence & Identity',
      item: 'Organization Aims and Objectives are documented',
      status: results.hasOrgObjectives ? 'Pass' : 'Fail',
      remarks: results.hasOrgObjectives ? 'Organization objectives/aims detected.' : 'No objectives documentation found.',
    }),
    normalizeCheck({
      key: 'presence.plans_programs',
      category: 'Presence & Identity',
      item: 'Plans Programs and Projects are documented',
      status: results.hasPlans ? 'Pass' : 'Fail',
      remarks: results.hasPlans ? 'Plans/programs/projects detected.' : 'No plans documentation.',
    }),
    normalizeCheck({
      key: 'presence.policy_releases',
      category: 'Presence & Identity',
      item: 'Policy/Regulation Releases are published',
      status: results.hasPolicyReleases ? 'Pass' : 'Fail',
      remarks: results.hasPolicyReleases ? 'Policy/regulation documents detected.' : 'No policy releases found.',
    }),
    normalizeCheck({
      key: 'presence.major_outputs',
      category: 'Presence & Identity',
      item: 'Major Final Outputs / PREAC (Budget Circulars etc) are published',
      status: results.hasMajorOutputs ? 'Pass' : 'Fail',
      remarks: results.hasMajorOutputs ? 'Major outputs/PREAC documents detected.' : 'No major outputs found.',
    }),
    normalizeCheck({
      key: 'resources.opportunities',
      category: 'Resources',
      item: 'Opportunities section is available',
      status: results.hasOpportunities ? 'Pass' : 'Fail',
      remarks: results.hasOpportunities ? 'Opportunities/careers section detected.' : 'No opportunities section.',
    }),
    normalizeCheck({
      key: 'resources.announcements',
      category: 'Resources',
      item: 'Announcements/Latest News/Events section is available',
      status: (results.hasAnnouncements || results.hasLatestNews) ? 'Pass' : 'Fail',
      remarks: (results.hasAnnouncements || results.hasLatestNews) ? 'News/announcements section detected.' : 'No announcements section.',
    }),
  ];
}

// Security & Privacy Checks
async function buildSecurityChecks(page, pageUrl) {
  const results = await page.evaluate((url) => {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const allLinks = Array.from(document.querySelectorAll('a'));
    
    // SSL check: Look at protocol
    const isHttps = url.startsWith('https://');
    
    // Privacy policy
    const hasPrivacyPolicy = allLinks.some(a => /privacy|data protection|gdpr|protection/i.test(a.textContent)) ||
                            /privacy policy|data protection|personal data/i.test(bodyText);
    
    // CAPTCHA
    const hasCaptcha = document.querySelector('iframe[src*="recaptcha"], .g-recaptcha, [data-captcha], .captcha, input[name*="captcha" i]') !== null ||
                       /captcha|recaptcha/.test(document.body?.innerHTML || '');
    
    // Security headers indicators
    const hasSecurityIndicators = /secure|https|ssl|tls|encryption|certificate/i.test(bodyText);
    
    return {
      isHttps,
      hasPrivacyPolicy,
      hasCaptcha,
      hasSecurityIndicators,
    };
  }, pageUrl);

  return [
    normalizeCheck({
      key: 'security.ssl',
      category: 'Security',
      item: 'SSL certificate is implemented',
      status: results.isHttps ? 'Pass' : 'Fail',
      remarks: results.isHttps ? 'Site uses HTTPS protocol.' : 'Site does not use HTTPS.',
    }),
    normalizeCheck({
      key: 'security.privacy_policy',
      category: 'Security',
      item: 'Privacy Policy is documented',
      status: results.hasPrivacyPolicy ? 'Pass' : 'Fail',
      remarks: results.hasPrivacyPolicy ? 'Privacy policy link or documentation detected.' : 'No privacy policy found.',
    }),
    normalizeCheck({
      key: 'security.captcha',
      category: 'Security',
      item: 'CAPTCHA is implemented for form protection',
      status: results.hasCaptcha ? 'Pass' : 'Fail',
      remarks: results.hasCaptcha ? 'CAPTCHA protection detected.' : 'No CAPTCHA protection found.',
    }),
  ];
}

// Advanced Participation & Community Tools
async function buildParticipationToolsChecks(page) {
  const signals = await inspectPageSignals(page, new URL(page.url()).origin);
  const results = await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const bodyHtml = document.body?.innerHTML || '';
    const allLinks = Array.from(document.querySelectorAll('a'));
    
    // Email alerts
    const hasEmailAlerts = /email alert|subscribe|newsletter|notification|mailing list/.test(bodyText) ||
                          document.querySelector('input[type="email"]') !== null;
    
    // Downloadable docs
    const hasDownloadableDocs = document.querySelectorAll('a[href*=".pdf"], a[href*=".doc"], a[href*=".xlsx"], a[href*=".zip"]').length > 0 ||
                               /download|pdf|document|report|file/.test(bodyText);
    
    // e-Signature
    const hasESignature = /e-signature|digital signature|sign document|esignature/.test(bodyText);
    
    // User login
    const hasUserLogin = document.querySelector('input[type="password"], button[type="submit"], [role="button"]') !== null &&
                        allLinks.some(a => /login|signin|register|account/i.test(a.textContent));
    
    // Confirmation functionality
    const hasConfirmation = /confirm|confirmation|acknowledge|verify|validation/.test(bodyText);
    
    // Other participation forms
    const hasSurveys = /survey|poll|opinion|feedback|questionnaire/.test(bodyText);
    const hasBlogs = allLinks.some(a => /blog|article|post|discussion/i.test(a.textContent)) ||
                    document.querySelectorAll('article, .post, .blog-entry').length > 0;
    const hasBulletinBoards = /bulletin|board|notice|message|post/.test(bodyText);
    const hasChatRoom = /chat|live chat|support|agent|conversation/.test(bodyText);
    
    // Policy/mission statements
    const hasPolicyMission = /policy|mission|participation|strategy|statement/.test(bodyText);
    
    // Feedback collection
    const hasFeedbackCollection = /feedback|survey|opinion|comment|suggestion|concern|complaint/.test(bodyText) ||
                                 document.querySelector('form, textarea[name*="feedback" i], textarea[name*="comment" i]') !== null;
    
    // Published feedback
    const hasFeedbackPublished = /feedback.*published|results.*feedback|comment.*posted|testimonial/i.test(bodyText);
    
    // Social integration
    const hasSocialIntegration = /facebook|twitter|instagram|linkedin|youtube|social/i.test(bodyText) ||
                               allLinks.some(a => /facebook\.com|twitter\.com|instagram\.com|linkedin\.com|youtube\.com/i.test(a.href));
    
    return {
      hasEmailAlerts,
      hasDownloadableDocs,
      hasESignature,
      hasUserLogin,
      hasConfirmation,
      hasSurveys,
      hasBlogs,
      hasBulletinBoards,
      hasChatRoom,
      hasPolicyMission,
      hasFeedbackCollection,
      hasFeedbackPublished,
      hasSocialIntegration,
    };
  });

  return [
    normalizeCheck({
      key: 'features.email_alerts',
      category: 'Features',
      item: 'e-Mail alerts for participation are available',
      status: results.hasEmailAlerts ? 'Pass' : 'Fail',
      remarks: results.hasEmailAlerts ? 'Email subscription/alerts detected.' : 'No email alerts feature.',
    }),
    normalizeCheck({
      key: 'features.downloadable_docs',
      category: 'Features',
      item: 'Downloadable Documents/Reports are available',
      status: results.hasDownloadableDocs ? 'Pass' : 'Fail',
      remarks: results.hasDownloadableDocs ? 'Downloadable documents detected.' : 'No downloadable documents.',
    }),
    normalizeCheck({
      key: 'features.esignature',
      category: 'Features',
      item: 'e-Signature capability is available',
      status: results.hasESignature ? 'Pass' : 'Fail',
      remarks: results.hasESignature ? 'e-Signature capability detected.' : 'No e-signature support.',
    }),
    normalizeCheck({
      key: 'features.user_login',
      category: 'Features',
      item: 'Public User login and password functionality is available',
      status: results.hasUserLogin ? 'Pass' : 'Fail',
      remarks: results.hasUserLogin ? 'Login functionality detected.' : 'No user login system.',
    }),
    normalizeCheck({
      key: 'features.confirmation_request',
      category: 'Features',
      item: 'Confirmation of request functionality is available',
      status: results.hasConfirmation ? 'Pass' : 'Fail',
      remarks: results.hasConfirmation ? 'Confirmation mechanism detected.' : 'No confirmation system.',
    }),
    normalizeCheck({
      key: 'tools.satisfaction_surveys',
      category: 'Participation Tools',
      item: 'Customer Satisfaction Surveys are available',
      status: results.hasSurveys ? 'Pass' : 'Fail',
      remarks: results.hasSurveys ? 'Survey/poll functionality detected.' : 'No surveys available.',
    }),
    normalizeCheck({
      key: 'tools.blogs',
      category: 'Participation Tools',
      item: 'Blogs are available',
      status: results.hasBlogs ? 'Pass' : 'Fail',
      remarks: results.hasBlogs ? 'Blog content detected.' : 'No blogs available.',
    }),
    normalizeCheck({
      key: 'tools.bulletin_boards',
      category: 'Participation Tools',
      item: 'Bulletin Boards/short page links are available',
      status: results.hasBulletinBoards ? 'Pass' : 'Fail',
      remarks: results.hasBulletinBoards ? 'Bulletin board detected.' : 'No bulletin boards.',
    }),
    normalizeCheck({
      key: 'tools.chat_room',
      category: 'Participation Tools',
      item: 'Chat Room is available',
      status: results.hasChatRoom ? 'Pass' : 'Fail',
      remarks: results.hasChatRoom ? 'Chat functionality detected.' : 'No chat support.',
    }),
    normalizeCheck({
      key: 'policy.mission_statement',
      category: 'Policy & Participation',
      item: 'e-participation policy and mission statement is documented',
      status: results.hasPolicyMission ? 'Pass' : 'Fail',
      remarks: results.hasPolicyMission ? 'Policy/mission statement detected.' : 'No policy documentation.',
    }),
    normalizeCheck({
      key: 'policy.upcoming_participation',
      category: 'Policy & Participation',
      item: 'Expanding coverage of upcoming e-participation activities is documented',
      status: results.hasConfirmation ? 'Pass' : 'Fail',
      remarks: results.hasConfirmation ? 'Upcoming activities info detected.' : 'No upcoming activities documented.',
    }),
    normalizeCheck({
      key: 'policy.archived_participation',
      category: 'Policy & Participation',
      item: 'Archived information about e-participation activities is documented',
      status: results.hasDownloadableDocs ? 'Pass' : 'Fail',
      remarks: results.hasDownloadableDocs ? 'Archived participation info detected.' : 'No archived information.',
    }),
    normalizeCheck({
      key: 'tools.opinion_polls',
      category: 'Participation Tools',
      item: 'Opinion Polls are available',
      status: results.hasSurveys ? 'Pass' : 'Fail',
      remarks: results.hasSurveys ? 'Polling mechanism detected.' : 'No opinion polls.',
    }),
    normalizeCheck({
      key: 'tools.social_networks',
      category: 'Participation Tools',
      item: 'Social Networking Sites integration is available',
      status: results.hasSocialIntegration ? 'Pass' : 'Fail',
      remarks: results.hasSocialIntegration ? 'Social media integration detected.' : 'No social media links.',
    }),
    normalizeCheck({
      key: 'feedback.strategy_feedback',
      category: 'Citizen Feedback',
      item: 'Citizen feedback on strategies and e-services is collected',
      status: results.hasFeedbackCollection ? 'Pass' : 'Fail',
      remarks: results.hasFeedbackCollection ? 'Feedback collection detected.' : 'No feedback mechanism.',
    }),
    normalizeCheck({
      key: 'feedback.publication_results',
      category: 'Citizen Feedback',
      item: 'Results of citizen feedback are published',
      status: results.hasFeedbackPublished ? 'Pass' : 'Fail',
      remarks: results.hasFeedbackPublished ? 'Published feedback results detected.' : 'No published feedback results.',
    }),
    normalizeCheck({
      key: 'presence.govph_footer_link',
      category: 'Presence & Identity',
      item: 'Links to other agencies (GOV.PH and Standard Footer)',
      // Priority 1: GovPH existence in top menu.
      // Priority 2: GovPH should be first + standard footer should contain agency links.
      status: signals.govphTopMenu ? 'Pass' : 'Fail',
      primaryPresent: signals.govphTopMenu === true,
      remarks: signals.govphTopMenu
        ? [
          !signals.govphIsFirstTopMenu
            ? 'Pass: GovPH link found, but it is not the first element in the top menu'
            : 'Pass: GovPH link found as first top-menu element.',
          signals.standardFooterHasAgencyLinks
            ? 'Standard footer links to government sites detected.'
            : 'Standard footer agency links were not detected.',
        ].join(' ')
        : 'GovPH link not detected in top menu.',
    }),
    normalizeCheck({
      key: 'presence.sitemap',
      category: 'Presence & Identity',
      item: 'Site Map is present',
      // Priority 1: sitemap exists.
      // Priority 2: user-facing hierarchical sitemap preferred over XML-only.
      status: signals.sitemapFound ? 'Pass' : 'Fail',
      primaryPresent: signals.sitemapFound === true,
      remarks: signals.sitemapFound
        ? (signals.sitemapXmlOnly
          ? 'Pass: XML sitemap detected; consider adding a hierarchical list for users'
          : 'Pass: Sitemap detected with user-facing structure.')
        : 'No sitemap detected.',
    }),
    normalizeCheck({
      key: 'presence.logo_masthead',
      category: 'Presence & Identity',
      item: 'Agency Name and Logos (Masthead)',
      status: results.hasPolicyMission ? 'Pass' : 'Fail',
      remarks: 'Agency identification elements detected.',
    }),
    normalizeCheck({
      key: 'presence.about_us',
      category: 'Presence & Identity',
      item: 'About Us section is present',
      // Item 5 hierarchical rule: pass when core agency information exists.
      status: signals.hasMandateMission ? 'Pass' : 'Fail',
      primaryPresent: signals.hasMandateMission === true,
      remarks: signals.hasMandateMission
        ? (signals.mandateMissionInAboutSection
          ? 'Pass: Mandate/Mission/Vision found in a dedicated About/Profile section.'
          : 'Pass: Mission/Vision found, but accessibility could be improved by placing them in a dedicated Profile section')
        : 'Mandate and Mission/Vision were not detected.',
    }),
  ];
}

// Missing Navigation Checks
async function buildMissingNavigationChecks(page, targetOrigin) {
  const results = await page.evaluate((origin) => {
    const allLinks = Array.from(document.querySelectorAll('a'));
    const bodyText = (document.body?.innerText || '').toLowerCase();
    
    // Helper function to check if href links to home
    const isHomeLink = (href) => {
      if (!href) return false;
      try {
        const resolved = new URL(href, origin);
        const path = resolved.pathname.toLowerCase();
        
        // Check if pathname is root
        if (path === '/' || path === '/index.html' || path === '/index.php' || path === '' || path === '.') {
          // Also check if the domain is the same (ignoring www)
          const originHost = new URL(origin).hostname;
          const resolvedHost = resolved.hostname;
          const originNormalized = originHost.replace(/^www\./, '');
          const resolvedNormalized = resolvedHost.replace(/^www\./, '');
          return originNormalized === resolvedNormalized;
        }
        return false;
      } catch {
        return false;
      }
    };
    
    // Logo home link - look for images with logo in alt/src that link home, or first header link
    const mastheadAnchors = Array.from(document.querySelectorAll('header a, nav a, [role="banner"] a, .navbar a, .logo-container a, .navbar-brand a, .agency-logo a'));
    let logoLinksHome = false;
    
    // First try to find logo link explicitly
    const logoAnchor = mastheadAnchors.find((anchor) => {
      const img = anchor.querySelector('img');
      const alt = (img?.getAttribute('alt') || '').toLowerCase();
      const src = (img?.getAttribute('src') || '').toLowerCase();
      return alt.includes('logo') || src.includes('logo') || src.includes('seal');
    });
    
    if (logoAnchor) {
      const logoHref = logoAnchor.getAttribute('href');
      logoLinksHome = isHomeLink(logoHref);
    }
    
    // If no explicit logo found, check if first masthead link with image goes home
    if (!logoLinksHome && mastheadAnchors.length > 0) {
      const firstMastheadLink = mastheadAnchors[0];
      const firstImg = firstMastheadLink.querySelector('img');
      if (firstImg) {
        const href = firstMastheadLink.getAttribute('href');
        logoLinksHome = isHomeLink(href);
      }
    }
    
    // Home link accessible
    const hasHomeLink = allLinks.some(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      const text = (a.textContent || '').toLowerCase().trim();
      const hrefUrl = new URL(a.href, window.location.origin);
      const homePath = hrefUrl.pathname.toLowerCase();
      
      // Match if text is "home"
      if (text === 'home') return true;
      // Match if href is root or index variants
      if (href === '/' || href === '/index.html' || href === '/index.php' || href === '') return true;
      // Match if resolved pathname is root or index
      if (homePath === '/' || homePath === '/index.html' || homePath === '/index.php') return true;
      
      return false;
    });
    
    // Site accessibility - look for skip links or clear navigation
    const hasSkipLink = allLinks.some(a => /skip|jump to content|skip to main/i.test(a.textContent));
    const hasNavigation = document.querySelector('nav, [role="navigation"]') !== null;
    const siteAccessible = hasSkipLink || hasNavigation;
    
    // Structure understanding - prefer explicit heading hierarchy (H1 -> H2 -> H3)
    const breadcrumbs = document.querySelector('nav[aria-label*="breadcrumb"], .breadcrumb');
    const hasHeadingHierarchy = Boolean(document.querySelector('h1') && document.querySelector('h2') && document.querySelector('h3'));
    const hasHeadings = document.querySelectorAll('h1, h2, h3').length > 3;
    const structureClear = Boolean(breadcrumbs) || hasHeadingHierarchy || hasHeadings;

    // Meta/tags clarity - include OpenGraph tags as valid metadata
    const metaTags = Array.from(document.querySelectorAll('meta[name], meta[property]'));
    const ogTitle = metaTags.find(m => (m.getAttribute('property') || '').toLowerCase() === 'og:title');
    const ogDescription = metaTags.find(m => (m.getAttribute('property') || '').toLowerCase() === 'og:description');
    const hasMetaTags = metaTags.some(m => (m.getAttribute('content') || '').length > 10) || Boolean(ogTitle) || Boolean(ogDescription);
    const metaCount = metaTags.filter(m => (m.getAttribute('content') || '').length > 0).length;

    // About/Contact/Home links grouped - use intent-based regex (covers Profile, Mandate, Reach Us, etc.)
    const aboutPattern = /about|profile|mandate|who\s*we\s*are|our\s*agency|overview/i;
    const contactPattern = /contact|get\s*in\s*touch|reach\s*us|directory|inquiries|help|support|reach[-_ ]?us|inquiry/i;
    const aboutLink = allLinks.find(a => aboutPattern.test((a.textContent || '') + ' ' + (a.getAttribute('href') || '')));
    const contactLink = allLinks.find(a => contactPattern.test((a.textContent || '') + ' ' + (a.getAttribute('href') || '')));
    const homeFound = hasHomeLink;
    const allThreeFound = Boolean(aboutLink && contactLink && homeFound);
    
    return {
      logoLinksHome,
      hasHomeLink,
      siteAccessible,
      structureClear,
      hasMetaTags,
      metaCount,
      allThreeFound,
    };
  }, targetOrigin);

  return [
    normalizeCheck({
      key: 'navigation.home_link_accessible',
      category: 'Navigation',
      item: 'Site logo is easy to find and links to the home page',
      status: results.logoLinksHome ? 'Pass' : 'Fail',
      remarks: results.logoLinksHome ? 'Logo found in masthead and links to homepage.' : 'Logo homepage link not properly configured.',
    }),
    normalizeCheck({
      key: 'navigation.about_contact_home_links',
      category: 'Navigation',
      item: 'The About Us Contact Us and Home links are easy to find',
      status: results.allThreeFound ? 'Pass' : 'Fail',
      remarks: results.allThreeFound ? 'All three critical links found.' : 'One or more critical links (About/Contact/Home) missing.',
    }),
    normalizeCheck({
      key: 'navigation.back_to_homepage',
      category: 'Navigation',
      item: 'User easily gets back to homepage or a relevant start point',
      status: results.logoLinksHome && results.hasHomeLink ? 'Pass' : 'Fail',
      remarks: results.logoLinksHome && results.hasHomeLink ? 'Multiple paths back to homepage detected.' : 'No clear path back to homepage.',
    }),
    normalizeCheck({
      key: 'navigation.access_site',
      category: 'Navigation',
      item: 'Users can easily access the site or application',
      status: results.siteAccessible ? 'Pass' : 'Fail',
      remarks: results.siteAccessible ? 'Accessible navigation detected.' : 'Navigation structure unclear.',
    }),
    normalizeCheck({
      key: 'navigation.structure_understanding',
      category: 'Navigation',
      item: 'The site of application structure is easily understood and addresses common user goals',
      status: results.structureClear ? 'Pass' : 'Fail',
      remarks: results.structureClear ? 'Clear site structure detected via breadcrumbs or headings.' : 'Site structure not clearly indicated.',
    }),
    normalizeCheck({
      key: 'navigation.tags_meta_clear',
      category: 'Navigation',
      item: 'The tags meta descriptions headers and URLs are clear and descriptive',
      status: results.hasMetaTags ? 'Pass' : 'Fail',
      remarks: results.hasMetaTags ? `Found ${results.metaCount} meta tags (including OpenGraph).` : 'Insufficient meta tag information.',
    }),
    normalizeCheck({
      key: 'navigation.logo_homepage_link',
      category: 'Navigation',
      item: 'Company logo is linked to home-page',
      status: results.logoLinksHome ? 'Pass' : 'Fail',
      remarks: results.logoLinksHome ? 'Logo correctly links to homepage.' : 'Logo does not link to homepage.',
    }),
  ];
}

// Missing Error Handling Checks
async function buildMissingErrorHandlingChecks(page) {
  const results = await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    
    // Error recovery - look for undo, back, retry, reset functionality
    const hasRecoverylinks = /undo|redo|back|retry|reset|clear|cancel|try again/.test(bodyText);
    const hasResetForm = document.querySelector('input[type="reset"], button[type="reset"]') !== null;
    const hasBackButton = Array.from(document.querySelectorAll('a, button')).some(el => 
      /back|previous|go back|< back|return/.test((el.textContent || '').toLowerCase())
    );
    const recoveryAvailable = hasRecoverylinks || hasResetForm || hasBackButton;
    
    // Error messages - check for help text, validation messages
    const hasErrorMessages = document.querySelectorAll('[role="alert"], .error, .error-message, .help-text, [aria-describedby]').length > 0 ||
                            /error|invalid|required|please|must|cannot|unable/i.test(bodyText);
    const hasFieldValidation = document.querySelector('input[required], input[aria-required="true"], textarea[required]') !== null;
    
    return {
      recoveryAvailable,
      hasErrorMessages,
      hasFieldValidation,
    };
  });

  return [
    normalizeCheck({
      key: 'error.recovery',
      category: 'Error Handling',
      item: 'Users can easily recover (i.e. not have to start again) from errors',
      status: results.recoveryAvailable ? 'Pass' : 'Fail',
      remarks: results.recoveryAvailable ? 'Error recovery paths detected (undo, back, reset).' : 'Limited error recovery options.',
    }),
    normalizeCheck({
      key: 'error.messages',
      category: 'Error Handling',
      item: 'Error messages are concise written in easy to understand language and describe what occurred and what action is necessary',
      status: results.hasErrorMessages && results.hasFieldValidation ? 'Pass' : 'Fail',
      remarks: (results.hasErrorMessages && results.hasFieldValidation) ? 'Error messaging system detected.' : 'Error messages or field validation missing.',
    }),
  ];
}

// Missing Brand Identity Checks  
async function buildMissingBrandIdentityChecks(page) {
  const results = await page.evaluate(() => {
    // Logo size - check for defined dimensions
    const logos = document.querySelectorAll('img[alt*="logo" i], img[src*="logo" i]');
    const logoWithSize = Array.from(logos).some(img => {
      const width = img.getAttribute('width');
      const height = img.getAttribute('height');
      const style = img.getAttribute('style');
      return (width && height) || (style && /width|height/.test(style));
    });
    
    // Homepage digestible in 5 seconds - check for clear purpose above fold
    const foldHeight = window.innerHeight;
    const h1 = document.querySelector('h1');
    const tagline = document.querySelector('h2, .tagline, .subtitle, .description');
    const mainCta = document.querySelector('button[type="submit"], a[role="button"], .cta');
    
    const h1AboveFold = h1 && h1.getBoundingClientRect().top < foldHeight && h1.getBoundingClientRect().top > 0;
    const taglineAboveFold = tagline && tagline.getBoundingClientRect().top < foldHeight && tagline.getBoundingClientRect().top > 0;
    const ctaAboveFold = mainCta && mainCta.getBoundingClientRect().top < foldHeight && mainCta.getBoundingClientRect().top > 0;
    
    const digestibleIn5Sec = (h1AboveFold && taglineAboveFold) || (h1AboveFold && ctaAboveFold);
    
    // Logo home link (same as navigation check but for identity category)
    const mastheadAnchors = Array.from(document.querySelectorAll('header a, nav a, [role="banner"] a'));
    let logoLinksHome = false;
    
    // Helper to check if link goes to home (handles www/non-www variants)
    const isHomeLink = (href) => {
      if (!href) return false;
      try {
        const resolved = new URL(href, window.location.origin);
        const path = resolved.pathname.toLowerCase();
        
        // Check if pathname is root
        if (path === '/' || path === '/index.html' || path === '/index.php' || path === '' || path === '.') {
          // Also check if the domain is the same (ignoring www)
          const locationHost = window.location.hostname;
          const resolvedHost = resolved.hostname;
          const locationNormalized = locationHost.replace(/^www\./, '');
          const resolvedNormalized = resolvedHost.replace(/^www\./, '');
          return locationNormalized === resolvedNormalized;
        }
        return false;
      } catch {
        return false;
      }
    };
    
    // First try to find logo link explicitly
    const logoLink = mastheadAnchors.find(a => {
      const img = a.querySelector('img');
      const alt = (img?.getAttribute('alt') || '').toLowerCase();
      const src = (img?.getAttribute('src') || '').toLowerCase();
      return img && (alt.includes('logo') || src.includes('logo') || src.includes('seal'));
    });
    
    if (logoLink) {
      logoLinksHome = isHomeLink(logoLink.getAttribute('href'));
    }
    
    // If no explicit logo found, check if first masthead link goes home
    if (!logoLinksHome && mastheadAnchors.length > 0) {
      const firstMastheadLink = mastheadAnchors[0];
      const firstImg = firstMastheadLink.querySelector('img');
      if (firstImg) {
        logoLinksHome = isHomeLink(firstMastheadLink.getAttribute('href'));
      }
    }
    
    return {
      logoWithSize,
      digestibleIn5Sec,
      logoLinksHome,
    };
  });

  return [
    normalizeCheck({
      key: 'identity.logo_size',
      category: 'Brand Identity',
      item: 'Follow recommended logo size as prescribed in GWT',
      status: results.logoWithSize ? 'Pass' : 'Fail',
      remarks: results.logoWithSize ? 'Logo dimensions properly defined.' : 'Logo size not explicitly configured.',
    }),
    normalizeCheck({
      key: 'identity.homepage_digestible',
      category: 'Brand Identity',
      item: 'Purpose of the site and critical actions are clear within 5 seconds',
      status: results.digestibleIn5Sec ? 'Pass' : 'Fail',
      remarks: results.digestibleIn5Sec ? 'Key information visible above the fold.' : 'Purpose/actions not immediately clear.',
    }),
    normalizeCheck({
      key: 'identity.logo_home_link',
      category: 'Brand Identity',
      item: 'Site logo links to the home page',
      status: results.logoLinksHome ? 'Pass' : 'Fail',
      remarks: results.logoLinksHome ? 'Logo correctly links to homepage.' : 'Logo does not link to homepage.',
    }),
  ];
}

// Missing Company Information Checks
async function buildMissingCompanyInfoChecks(page) {
  const results = await page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll('a'));
    const bodyText = (document.body?.innerText || '').toLowerCase();
    
    // Improved home link detection
    const hasHome = allLinks.some(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      const text = (a.textContent || '').toLowerCase().trim();
      const hrefUrl = new URL(a.href, window.location.origin);
      const homePath = hrefUrl.pathname.toLowerCase();
      
      if (text === 'home') return true;
      if (href === '/' || href === '/index.html' || href === '/index.php' || href === '') return true;
      if (homePath === '/' || homePath === '/index.html' || homePath === '/index.php') return true;
      
      return false;
    });
    
    return {
      hasHome,
      hasTransparency: allLinks.some(a => /transparency|seal|disclosur/i.test(a.textContent)) || /transparency|seal|disclosure/i.test(bodyText),
      hasKeyOfficial: /key official|official|director|head|chief|manager|leadership|management team/i.test(bodyText),
    };
  });

  return [
    normalizeCheck({
      key: 'company_info.home_link',
      category: 'Company Information',
      item: 'Home link is easy to find',
      status: results.hasHome ? 'Pass' : 'Fail',
      remarks: results.hasHome ? 'Home link detected.' : 'Home link not found.',
    }),
    normalizeCheck({
      key: 'company_info.transparency_link',
      category: 'Company Information',
      item: 'Transparency Link is easy to find',
      status: results.hasTransparency ? 'Pass' : 'Fail',
      remarks: results.hasTransparency ? 'Transparency seal or link detected.' : 'No transparency link found.',
    }),
    normalizeCheck({
      key: 'company_info.key_official',
      category: 'Company Information',
      item: 'Key Official Corner is easy to find',
      status: results.hasKeyOfficial ? 'Pass' : 'Fail',
      remarks: results.hasKeyOfficial ? 'Key official information detected.' : 'No key official section.',
    }),
  ];
}

// Missing Content Checks
async function buildMissingContentChecks(page) {
  const results = await page.evaluate(() => {
    // Meta descriptions and tags clarity
    const metaTags = Array.from(document.querySelectorAll('meta[name="description"], meta[name="keywords"], meta[property]'));
    const hasMetaContent = metaTags.length > 0 && metaTags.some(m => (m.getAttribute('content') || '').length > 10);
    
    // Headers descriptive
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const hasDescriptiveHeadings = headings.some(h => (h.textContent || '').trim().length > 5);
    
    // Critical purpose clear in 5 seconds
    const foldHeight = window.innerHeight;
    const mainHeading = document.querySelector('h1');
    const purposeText = mainHeading && mainHeading.getBoundingClientRect().top < foldHeight;
    const hasValue = /offer|provide|deliver|about|since|founded|established/i.test(document.body?.innerText || '');
    const purposeClear = purposeText && hasValue;
    
    // Eye path optimization - look for visual hierarchy
    const heroElements = document.querySelectorAll('[class*="hero"], [class*="banner"], [class*="jumbotron"]');
    const largeImages = document.querySelectorAll('img');
    const largeImageAboveFold = Array.from(largeImages).some(img => {
      const rect = img.getBoundingClientRect();
      return rect.top < foldHeight && rect.width > 200 && rect.height > 150;
    });
    const eyePathOptimized = heroElements.length > 0 || largeImageAboveFold;
    
    // Emphasis usage - check for moderate use of bold/strong
    const boldElements = document.querySelectorAll('strong, b, [style*="font-weight"]');
    const emphasisModerate = boldElements.length > 0 && boldElements.length < 50;
    
    // Link color contrast - detect if links are colored
    const links = document.querySelectorAll('a');
    const styledLinks = Array.from(links).filter(l => {
      const style = window.getComputedStyle(l);
      const color = style.color;
      return color && color !== 'rgb(0, 0, 0)';
    });
    const linkContrast = styledLinks.length > 0;
    
    return {
      hasMetaContent,
      hasDescriptiveHeadings,
      purposeClear,
      eyePathOptimized,
      emphasisModerate,
      linkContrast,
    };
  });

  return [
    normalizeCheck({
      key: 'content.tag_meta_descriptions',
      category: 'Content',
      item: 'Page tags meta descriptions headers and URLs are clear and descriptive',
      status: results.hasMetaContent ? 'Pass' : 'Fail',
      remarks: results.hasMetaContent ? 'Meta tags and descriptions detected.' : 'Meta tags missing or empty.',
    }),
    normalizeCheck({
      key: 'content.headers_descriptive',
      category: 'Content',
      item: 'Headers are descriptive',
      status: results.hasDescriptiveHeadings ? 'Pass' : 'Fail',
      remarks: results.hasDescriptiveHeadings ? 'Descriptive headings detected.' : 'Headings are generic or missing.',
    }),
    normalizeCheck({
      key: 'content.critical_purpose_clear',
      category: 'Content',
      item: 'Purpose of the site and the critical actions are clear within 5 seconds',
      status: results.purposeClear ? 'Pass' : 'Fail',
      remarks: results.purposeClear ? 'Site purpose clearly communicated above fold.' : 'Site purpose not immediately apparent.',
    }),
    normalizeCheck({
      key: 'content.critical_eye_path',
      category: 'Content',
      item: 'Critical content is where the user\'s eye naturally goes',
      status: results.eyePathOptimized ? 'Pass' : 'Fail',
      remarks: results.eyePathOptimized ? 'Visual hierarchy and design guide user attention.' : 'Eye path not optimized.',
    }),
    normalizeCheck({
      key: 'content.emphasis_sparingly',
      category: 'Content',
      item: 'Emphasis (bold etc.) is used sparingly',
      status: results.emphasisModerate ? 'Pass' : 'Fail',
      remarks: results.emphasisModerate ? `Moderate emphasis usage (${results.emphasisModerate} elements).` : 'Excessive or no emphasis detected.',
    }),
    normalizeCheck({
      key: 'a11y.color_links',
      category: 'Technical Accessibility',
      item: 'Color alone is not used to distinguish links from surrounding text unless the luminance contrast is at least 3:1',
      status: results.linkContrast ? 'Pass' : 'Fail',
      remarks: results.linkContrast ? 'Links have distinct styling/color.' : 'Links not visually distinct.',
    }),
  ];
}

// Missing Participation Checks
async function buildMissingParticipationChecks(page) {
  const results = await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const allLinks = Array.from(document.querySelectorAll('a'));
    
    // Other forms of e-participation
    const hasOtherParticipation = /webinar|workshop|training|seminar|conference|event|activity|program/.test(bodyText) ||
                                 allLinks.some(a => /event|calendar|workshop|training/i.test(a.textContent));
    
    return {
      hasOtherParticipation,
    };
  });

  return [
    normalizeCheck({
      key: 'participation.other_forms',
      category: 'eParticipation',
      item: 'Other Forms of e-Participation are available',
      status: results.hasOtherParticipation ? 'Pass' : 'Fail',
      remarks: results.hasOtherParticipation ? 'Alternative participation mechanisms detected.' : 'No alternative participation options found.',
    }),
  ];
}

module.exports = {
  buildPerformanceCheckFromTrials,
  buildAccessibilityChecks,
  buildPresenceIdentityChecks,
  buildTopNavigationChecks,
  countNonDescriptiveLinks,
  buildCustom404Check,
  normalizeCheck,
  buildContentAccessibilityChecks,
  buildNavigationStructureChecks,
  buildBrandIdentityChecks,
  buildCompanyInfoChecks,
  buildContactInfoChecks,
  buildWebPresenceStageChecks,
  buildContentQualityChecks,
  buildBrowserCompatibilityChecks,
  buildAdvancedPresenceChecks,
  buildSecurityChecks,
  buildParticipationToolsChecks,
  buildMissingNavigationChecks,
  buildMissingErrorHandlingChecks,
  buildMissingBrandIdentityChecks,
  buildMissingCompanyInfoChecks,
  buildMissingContentChecks,
  buildMissingParticipationChecks,
};
