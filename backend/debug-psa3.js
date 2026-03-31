const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Loading page...');
    await page.goto('https://psa.gov.ph', { waitUntil: 'load', timeout: 60000 });
    
    console.log('Waiting 3 seconds for content to render...');
    await page.waitForTimeout(3000);
    
    const content = await page.evaluate(() => {
      const text = document.body?.innerText || 'EMPTY';
      const links = Array.from(document.querySelectorAll('a'));
      const imgs = Array.from(document.querySelectorAll('img'));
      const html = document.documentElement.outerHTML;
      
      return {
        textLength: text.length,
        firstText: text.substring(0, 200),
        linkCount: links.length,
        imageCount: imgs.length,
        htmlLength: html.length,
        bodyHtmlLength: document.body?.innerHTML.length || 0,
      };
    });
    
    console.log('Content loaded:');
    console.log('  Text length:', content.textLength);
    console.log('  First text:', content.firstText?.substring(0, 100));
    console.log('  Link count:', content.linkCount);
    console.log('  Image count:', content.imageCount);
    console.log('  Page HTML length:', content.htmlLength);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
