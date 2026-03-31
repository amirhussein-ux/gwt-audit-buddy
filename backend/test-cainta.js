const { chromium } = require('playwright');
const checks = require('./src/audit/molecules/gwtChecker');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('\n=== Testing on cainta.gov.ph ===\n');
    await page.goto('https://cainta.gov.ph', { waitUntil: 'load', timeout: 30000 });
    
    // Test Advanced Presence Checks (includes presence.home)
    const advChecks = await checks.buildAdvancedPresenceChecks(page);
    const homeCheck = advChecks.find(c => c.key === 'presence.home');
    console.log(`✓ presence.home: ${homeCheck.status}`);
    console.log(`  Remarks: ${homeCheck.remarks}`);
    
    // Test Company Info Checks (includes company_info.home_link)
    const companyChecks = await checks.buildMissingCompanyInfoChecks(page);
    const companyHomeCheck = companyChecks.find(c => c.key === 'company_info.home_link');
    console.log(`\n✓ company_info.home_link: ${companyHomeCheck.status}`);
    console.log(`  Remarks: ${companyHomeCheck.remarks}`);
    
    // Test Navigation Checks (includes navigation.home_link_accessible)
    const navChecks = await checks.buildMissingNavigationChecks(page, 'https://cainta.gov.ph');
    const navHomeCheck = navChecks.find(c => c.key === 'navigation.home_link_accessible');
    console.log(`\n✓ navigation.home_link_accessible: ${navHomeCheck.status}`);
    console.log(`  Remarks: ${navHomeCheck.remarks}`);
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
