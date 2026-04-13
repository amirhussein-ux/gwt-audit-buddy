const { chromium } = require('playwright');

const siteUrl = process.argv[2] || 'https://marikina.gov.ph';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log(`✔ Testing Procurement/Portal/Calendar detection on ${siteUrl}...\n`);
    
    await page.goto(siteUrl, { waitUntil: 'load', timeout: 30000 });
    
    const result = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      const allLinks = Array.from(document.querySelectorAll('a'));
      
      // Procurement/Bids detection
      const hasProcurement = /bid|procurement|purchase|tender|rfp|award|auction|supplier|vendor/.test(bodyText) ||
                            allLinks.some(a => /bid|procurement|purchase|tender|award/i.test(a.textContent || a.getAttribute('href') || '')) ||
                            document.querySelectorAll('a[href*="bid" i], a[href*="procurement" i], a[href*="purchase" i], a[href*="tender" i]').length > 0;
      
      // Portal/One-stop-shop detection
      const hasPortal = /portal|one-stop|integration|online.*service|e-service|e-government/.test(bodyText) ||
                       allLinks.some(a => /portal|one-stop|integration|e-service/i.test(a.textContent || a.getAttribute('href') || '')) ||
                       document.querySelectorAll('a[href*="portal" i], a[href*="integration" i], a[href*="e-service" i]').length > 0 ||
                       document.querySelector('[id*="portal" i], [class*="portal" i], [id*="one-stop" i], [class*="one-stop" i]') !== null;
      
      // Calendar detection
      let hasCalendar = false;
      if (document.querySelector('[id*="calendar" i], [class*="calendar" i], [id*="event" i], [class*="event" i]')) {
        hasCalendar = true;
      }
      if (!hasCalendar && document.querySelector('input[type="date"], input[type="datetime"], [role="navigation"][aria-label*="calendar" i]')) {
        hasCalendar = true;
      }
      if (!hasCalendar && document.querySelectorAll('time, [role="button"][aria-label*="date" i]').length > 0) {
        hasCalendar = true;
      }
      
      return { hasProcurement, hasPortal, hasCalendar };
    });
    
    console.log('=== DETECTION RESULTS ===');
    console.log(`Procurement/Bids: ${result.hasProcurement ? '✅ DETECTED' : '❌ NOT DETECTED'}`);
    console.log(`Portal/One-stop: ${result.hasPortal ? '✅ DETECTED' : '❌ NOT DETECTED'}`);
    console.log(`Calendar: ${result.hasCalendar ? '✅ DETECTED' : '❌ NOT DETECTED'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
