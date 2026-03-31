const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('https://cainta.gov.ph', { waitUntil: 'load', timeout: 30000 });
    
    const result = await page.evaluate(() => {
      const origin = 'https://cainta.gov.ph';
      
      const isHomeLink = (href) => {
        if (!href) return false;
        try {
          const resolved = new URL(href, origin);
          const path = resolved.pathname.toLowerCase();
          const originUrl = new URL(origin);
          
          console.log(`\nChecking href: ${href}`);
          console.log(`  resolved.origin: ${resolved.origin}`);
          console.log(`  originUrl.origin: ${originUrl.origin}`);
          console.log(`  path: "${path}"`);
          console.log(`  resolved.href: ${resolved.href}`);
          console.log(`  originUrl.href: ${originUrl.href}`);
          
          // Check if same origin and path is root
          if (resolved.origin === originUrl.origin) {
            const isRoot = path === '/' || path === '/index.html' || path === '/index.php' || path === '' || path === '.';
            console.log(`  Same origin, path is root: ${isRoot}`);
            return isRoot;
          }
          const normalized1 = resolved.href.replace(/\/$/, '');
          const normalized2 = originUrl.href.replace(/\/$/, '');
          const matches = normalized1 === normalized2;
          console.log(`  normalized comparison: "${normalized1}" === "${normalized2}" = ${matches}`);
          return matches;
        } catch(e) {
          console.log(`  Error: ${e.message}`);
          return false;
        }
      };
      
      const mastheadAnchors = Array.from(document.querySelectorAll('header a, nav a, [role="banner"] a'));
      console.log(`Found ${mastheadAnchors.length} masthead anchors`);
      
      // Check first link
      if (mastheadAnchors.length > 0) {
        const first = mastheadAnchors[0];
        const firstImg = first.querySelector('img');
        const href = first.getAttribute('href');
        console.log(`\n=== First Link (with img: ${!!firstImg}) ===`);
        const result = isHomeLink(href);
        console.log(`RESULT: ${result}`);
      }
      
      return 'check console output above';
    });
    
    console.log(`\nTest result: ${result}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
