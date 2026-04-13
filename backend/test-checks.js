const { chromium } = require('playwright');

const checks = require('./src/audit/molecules/gwtChecker');

console.log('\n=== Available Check Functions ===');
console.log('buildMissingNavigationChecks:', typeof checks.buildMissingNavigationChecks);
console.log('buildMissingErrorHandlingChecks:', typeof checks.buildMissingErrorHandlingChecks);
console.log('buildMissingBrandIdentityChecks:', typeof checks.buildMissingBrandIdentityChecks);
console.log('buildMissingCompanyInfoChecks:', typeof checks.buildMissingCompanyInfoChecks);
console.log('buildMissingContentChecks:', typeof checks.buildMissingContentChecks);
console.log('buildMissingParticipationChecks:', typeof checks.buildMissingParticipationChecks);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://www.example.com', { waitUntil: 'load', timeout: 15000 });
    
    console.log('\n=== Testing Check Functions ===\n');
    
    const navChecks = await checks.buildMissingNavigationChecks(page, 'https://www.example.com');
    console.log(`✓ Navigation Checks: ${navChecks.length} items`);
    navChecks.forEach(c => console.log(`  - ${c.key}: ${c.status}`));
    
    const errorChecks = await checks.buildMissingErrorHandlingChecks(page);
    console.log(`\n✓ Error Handling Checks: ${errorChecks.length} items`);
    errorChecks.forEach(c => console.log(`  - ${c.key}: ${c.status}`));
    
    const brandChecks = await checks.buildMissingBrandIdentityChecks(page);
    console.log(`\n✓ Brand Identity Checks: ${brandChecks.length} items`);
    brandChecks.forEach(c => console.log(`  - ${c.key}: ${c.status}`));
    
    const companyChecks = await checks.buildMissingCompanyInfoChecks(page);
    console.log(`\n✓ Company Info Checks: ${companyChecks.length} items`);
    companyChecks.forEach(c => console.log(`  - ${c.key}: ${c.status}`));
    
    const contentChecks = await checks.buildMissingContentChecks(page);
    console.log(`\n✓ Content Checks: ${contentChecks.length} items`);
    contentChecks.forEach(c => console.log(`  - ${c.key}: ${c.status}`));
    
    const partChecks = await checks.buildMissingParticipationChecks(page);
    console.log(`\n✓ Participation Checks: ${partChecks.length} items`);
    partChecks.forEach(c => console.log(`  - ${c.key}: ${c.status}`));
    
    console.log('\n✅ All check functions executed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error during testing:', error.message);
  } finally {
    await browser.close();
  }
})();
