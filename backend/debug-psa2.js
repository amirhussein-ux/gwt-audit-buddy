const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('https://psa.gov.ph', { waitUntil: 'networkidle', timeout: 30000 });
    
    const content = await page.evaluate(() => {
      const text = document.body?.innerText || 'NO TEXT';
      const links = Array.from(document.querySelectorAll('a'));
      const imgs = Array.from(document.querySelectorAll('img'));
      
      return {
        textPreview: text.substring(0, 500),
        textLength: text.length,
        linkCount: links.length,
        imageCount: imgs.length,
        allLinks: links.map(l => ({ text: l.textContent?.trim(), href: l.getAttribute('href') })).slice(0, 20),
        allImages: imgs.slice(0, 5).map(i => ({ alt: i.getAttribute('alt'), src: i.getAttribute('src') })),
      };
    });
    
    console.log('Text length:', content.textLength);
    console.log('\nFirst 500 chars:');
    console.log(content.textPreview);
    console.log('\n---\n');
    console.log('Link count:', content.linkCount);
    console.log('Image count:', content.imageCount);
    console.log('\nFirst 20 Links:');
    content.allLinks.forEach((l, i) => {
      console.log(`[${i}] "${l.text}" -> ${l.href?.substring(0, 60)}`);
    });
    console.log('\nFirst 5 Images:');
    content.allImages.forEach((img, i) => {
      console.log(`[${i}] alt="${img.alt}", src="${img.src?.substring(0, 80)}"`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
