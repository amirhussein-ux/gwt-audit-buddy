const { chromium } = require('playwright');
const checks = require('./src/audit/molecules/gwtChecker');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('\n=== Testing PSA.gov.ph Detection ===\n');
    await page.goto('https://psa.gov.ph', { waitUntil: 'load', timeout: 30000 });
    
    // Test key checks
    const advChecks = await checks.buildAdvancedPresenceChecks(page);
    const contactChecks = await checks.buildContactInfoChecks(page);
    const navChecks = await checks.buildNavigationStructureChecks(page, 'https://psa.gov.ph');
    const brandChecks = await checks.buildBrandIdentityChecks(page);
    
    // Display relevant results
    console.log('=== Advanced Presence Checks ===');
    advChecks.forEach(c => {
      if (['presence.home', 'presence.masthead', 'presence.logo_home'].some(k => c.key.includes(k))) {
        console.log(`${c.key}: ${c.status}`);
      }
    });
    
    console.log('\n=== Contact Info Checks ===');
    contactChecks.forEach(c => {
      console.log(`${c.key}: ${c.status}`);
      if (c.status === 'Fail') console.log(`  Remarks: ${c.remarks}`);
    });
    
    console.log('\n=== Navigation Checks ===');
    navChecks.slice(0, 5).forEach(c => {
      console.log(`${c.key}: ${c.status}`);
    });
    
    console.log('\n=== Brand Identity Checks ===');
    brandChecks.forEach(c => {
      console.log(`${c.key}: ${c.status}`);
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
