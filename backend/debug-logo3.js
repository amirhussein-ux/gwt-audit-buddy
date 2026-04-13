const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
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
          
          const debug = {
            href,
            resolved_origin: resolved.origin,
            origin_url_origin: originUrl.origin,
            path,
            resolved_href: resolved.href,
            origin_url_href: originUrl.href,
          };
          
          // Check if same origin and path is root
          if (resolved.origin === originUrl.origin) {
            const isRoot = path === '/' || path === '/index.html' || path === '/index.php' || path === '' || path === '.';
            return {
              result: isRoot,
              reason: 'same origin, path is root: ' + isRoot
            };
          }
          const normalized1 = resolved.href.replace(/\/$/, '');
          const normalized2 = originUrl.href.replace(/\/$/, '');
          const matches = normalized1 === normalized2;
          return {
            result: matches,
            reason: 'href comparison',
            norm1: normalized1,
            norm2: normalized2
          };
        } catch(e) {
          return {
            result: false,
            reason: e.message
          };
        }
      };
      
      const mastheadAnchors = Array.from(document.querySelectorAll('header a, nav a, [role="banner"] a'));
      
      // Check first link
      if (mastheadAnchors.length > 0) {
        const first = mastheadAnchors[0];
        const firstImg = first.querySelector('img');
        const href = first.getAttribute('href');
        const linkResult = isHomeLink(href);
        
        return {
          total_anchors: mastheadAnchors.length,
          first_link_has_img: !!firstImg,
          first_link_href: href,
          home_link_check: linkResult
        };
      }
      
      return { error: 'No masthead anchors found' };
    });
    
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
