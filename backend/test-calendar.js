const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Testing calendar detection on Mandaluyong...\n');
    
    await page.goto('https://mandaluyong.gov.ph', { waitUntil: 'load', timeout: 30000 });
    
    const hasCalendar = await page.evaluate(() => {
      let hasCalendar = false;
      
      // 1. Look for calendar elements by ID/class
      if (document.querySelector('[id*="calendar" i], [class*="calendar" i], [id*="event" i], [class*="event" i]')) {
        hasCalendar = true;
        console.log('✓ Found calendar element by ID/class');
      }
      
      // 2. Look for date picker / date input elements
      if (!hasCalendar && document.querySelector('input[type="date"], input[type="datetime"], [role="navigation"][aria-label*="calendar" i]')) {
        hasCalendar = true;
        console.log('✓ Found date input element');
      }
      
      // 3. Look for time/date elements
      if (!hasCalendar && document.querySelectorAll('time, [role="button"][aria-label*="date" i]').length > 0) {
        hasCalendar = true;
        console.log('✓ Found time/date elements');
      }
      
      // 4. Look for month/year pattern
      if (!hasCalendar) {
        const months = ['january|february|march|april|may|june|july|august|september|october|november|december'];
        const monthYearPattern = new RegExp(`(?:${months[0]})\\s+\\d{4}|\\d{4}\\s+(?:${months[0]})`, 'i');
        const bodyText = document.body.innerText.toLowerCase();
        if (monthYearPattern.test(bodyText)) {
          hasCalendar = true;
          console.log('✓ Found month/year pattern');
        }
      }
      
      // 5. Look for iframe
      if (!hasCalendar && document.querySelector('iframe[src*="calendar" i], iframe[src*="google" i][src*="calendar" i]')) {
        hasCalendar = true;
        console.log('✓ Found calendar iframe');
      }
      
      // 6. Table with day names
      if (!hasCalendar) {
        const tables = document.querySelectorAll('table');
        for (let table of tables) {
          const text = table.textContent.toLowerCase();
          if (/\bsun\b.*\bmon\b.*\btue\b|\bmonday\b.*\btuesday\b.*\bwednesday\b/i.test(text)) {
            hasCalendar = true;
            console.log('✓ Found table with day names');
            break;
          }
        }
      }
      
      // 7. Day/date patterns
      if (!hasCalendar) {
        const bodyText = document.body.innerText.toLowerCase();
        if (/\b(?:sun|mon|tue|wed|thu|fri|sat)\b.*\b(?:1[0-9]|2[0-9]|30|31|[1-9])\b|\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(bodyText)) {
          hasCalendar = true;
          console.log('✓ Found day/date patterns in text');
        }
      }
      
      return hasCalendar;
    });
    
    console.log(`\nResult: ${hasCalendar ? '✅ CALENDAR DETECTED' : '❌ CALENDAR NOT DETECTED'}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
