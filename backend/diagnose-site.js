const { chromium } = require('playwright');

const siteUrl = process.argv[2] || 'https://mandaluyong.gov.ph';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log(`🔍 Diagnosing ${siteUrl}...\n`);
    
    await page.goto(siteUrl, { waitUntil: 'load', timeout: 30000 });
    console.log(`✅ Page loaded: ${page.url()}\n`);
    
    // 1. HOME LINK DETECTION
    console.log('=== HOME LINK DETECTION ===');
    const homeResults = await page.evaluate(() => {
      const byRole = Array.from(document.querySelectorAll('a')).find(a => 
        /\bhome\b|homepage|go\s+to\s+home/i.test(a.getAttribute('aria-label') || a.textContent || '')
      );
      
      const href1 = document.querySelector('a[href="/"]');
      const href2 = document.querySelector('a[href="./"]');
      const hrefEnd = document.querySelector('a[href$="/"]');
      const hrefIndex = document.querySelector('a[href*="index.html"], a[href*="index.php"]');
      const hrefHome = document.querySelector('a[href*="/home"]');
      
      // Get ALL home-like links
      const allLinks = Array.from(document.querySelectorAll('header a, nav a, [role="navigation"] a'));
      const homeLinks = allLinks.filter(a => 
        /home/i.test(a.textContent|| '')
      );
      
      return {
        byRole: !!byRole,
        href_slash: href1 ? href1.getAttribute('href') : null,
        href_dot: href2 ? href2.getAttribute('href') : null,
        hrefEnd: hrefEnd ? hrefEnd.getAttribute('href') : null,
        hrefIndex: hrefIndex ? hrefIndex.getAttribute('href') : null,
        hrefHome: hrefHome ? hrefHome.getAttribute('href') : null,
        homeLinks_found: homeLinks.length,
        homeLinks_sample: homeLinks.slice(0, 3).map(a => ({
          text: a.textContent.trim(),
          href: a.getAttribute('href')
        }))
      };
    });
    console.log(JSON.stringify(homeResults, null, 2));
    
    // 2. PST DETECTION
    console.log('\n=== PST DETECTION ===');
    const pstResults = await page.evaluate(() => {
      const pstContainer = document.querySelector('#pst-container, .pst-time, [id*="pst" i], [class*="pst" i]');
      const bodyText = document.body.innerText.slice(0, 2000);
      
      // Look for time patterns
      const hasTimePattern = /\b\d{1,2}:\d{2}:\d{2}\s*(?:am|pm)?\b/i.test(bodyText);
      const hasPhilippineStandardTime = /philippine\s+standard\s+time/i.test(bodyText);
      const hasPSTPHT = /(pht\b|\bpst\b|gmt\s*\+?8|utc\s*\+?8|\+08:00)/i.test(bodyText);
      
      // Get top bar content
      const topBar = document.querySelector('.top-bar, .masthead, header, [role="banner"]');
      const topBarText = topBar ? topBar.innerText : '';
      
      return {
        pstContainer_found: !!pstContainer,
        pstContainer_text: pstContainer ? pstContainer.innerText.slice(0, 100) : null,
        hasTimePattern: hasTimePattern,
        hasPhilippineStandardTime: hasPhilippineStandardTime,
        hasPSTPHT: hasPSTPHT,
        topBar_sample: topBarText.slice(0, 200),
        full_bodyText_header: bodyText.slice(0, 300)
      };
    });
    console.log(JSON.stringify(pstResults, null, 2));
    
    // 3. LOGO DETECTION
    console.log('\n=== LOGO DETECTION ===');
    const logoResults = await page.evaluate(() => {
      const logoInHeader = document.querySelector('header a:has(img), header a:has(svg), [role="banner"] a:has(img), [role="banner"] a:has(svg)');
      const allHeaderImages = Array.from(document.querySelectorAll('header img, [role="banner"] img'));
      const allHeaderAnchors = Array.from(document.querySelectorAll('header a, [role="banner"] a'));
      
      // Get hrefs of anchors in header
      const anchorHrefs = allHeaderAnchors.map(a => ({
        text: a.textContent.trim().slice(0, 50),
        href: a.getAttribute('href')
      }));
      
      return {
        logoInHeader_found: !!logoInHeader,
        logoInHeader_href: logoInHeader ? logoInHeader.getAttribute('href') : null,
        totalImages_inHeader: allHeaderImages.length,
        totalAnchors_inHeader: allHeaderAnchors.length,
        anchorHrefs_sample: anchorHrefs.slice(0, 5),
        images_alts: allHeaderImages.slice(0, 3).map(img => ({
          alt: img.getAttribute('alt'),
          src: img.getAttribute('src').slice(-50)
        }))
      };
    });
    console.log(JSON.stringify(logoResults, null, 2));
    
    console.log('\n✅ Diagnosis complete!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
