const {
  detectPst,
  detectHomeLink,
  detectLogoLinksHome,
  detectNavLinkByIntent,
} = require('./src/audit/atoms/gwtHeuristics');
const { chromium } = require('playwright');

const siteUrl = process.argv[2] || 'https://mandaluyong.gov.ph';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log(`🔍 Testing detector functions on ${siteUrl}...\n`);
    
    await page.goto(siteUrl, { waitUntil: 'load', timeout: 30000 });
    const origin = new URL(page.url()).origin;
    
    console.log(`✅ Page loaded: ${page.url()}\n`);
    
    // Call the actual detector functions
    const [homeResult, logoResult, aboutResult, contactResult, pstResult] = await Promise.all([
      detectHomeLink(page, origin),
      detectLogoLinksHome(page, origin),
      detectNavLinkByIntent(page, 'about'),
      detectNavLinkByIntent(page, 'contact'),
      detectPst(page),
    ]);
    
    console.log('=== DETECTOR RESULTS ===\n');
    console.log('Home Link:', JSON.stringify(homeResult, null, 2));
    console.log('\nLogo Links Home:', JSON.stringify(logoResult, null, 2));
    console.log('\nAbout Link:', JSON.stringify(aboutResult, null, 2));
    console.log('\nContact Link:', JSON.stringify(contactResult, null, 2));
    console.log('\nPST:', JSON.stringify(pstResult, null, 2));
    
    console.log('\n✅ Detection complete!');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
