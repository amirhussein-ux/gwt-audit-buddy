const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('https://cainta.gov.ph', { waitUntil: 'load', timeout: 30000 });
    
    const logoInfo = await page.evaluate(() => {
      const mastheadAnchors = Array.from(document.querySelectorAll('header a, nav a, [role="banner"] a'));
      console.log(`Found ${mastheadAnchors.length} masthead anchors`);
      
      mastheadAnchors.forEach((a, idx) => {
        const img = a.querySelector('img');
        const href = a.getAttribute('href');
        console.log(`[${idx}] href: ${href}, has img: ${!!img}`);
        if (img) {
          console.log(`      img alt: ${img.getAttribute('alt')}, img src: ${img.getAttribute('src')}`);
        }
      });
      
      // Check first link details
      if (mastheadAnchors.length > 0) {
        const first = mastheadAnchors[0];
        const firstImg = first.querySelector('img');
        const href = first.getAttribute('href');
        console.log('\n=== First Header Link ===');
        console.log(`href: ${href}`);
        console.log(`has img: ${!!firstImg}`);
        if (firstImg) {
          console.log(`img alt: ${firstImg.getAttribute('alt')}`);
          console.log(`img src: ${firstImg.getAttribute('src')}`);
        }
        if (href) {
          try {
            const resolved = new URL(href, window.location.origin);
            console.log(`resolved origin: ${resolved.origin}`);
            console.log(`resolved pathname: ${resolved.pathname}`);
            console.log(`location.origin: ${window.location.origin}`);
          } catch (e) {
            console.log(`Failed to parse: ${e.message}`);
          }
        }
      }
      
      return mastheadAnchors.map(a => ({
        href: a.getAttribute('href'),
        text: a.textContent?.trim(),
        hasImg: !!a.querySelector('img'),
      }));
    });
    
    console.log('\nHeader links:', logoInfo);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
