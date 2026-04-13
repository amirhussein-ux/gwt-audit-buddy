const { runAudit } = require('./src/services/auditEngine');

(async () => {
  const siteUrl = process.argv[2] || 'https://mandaluyong.gov.ph';
  
  console.log(`🔍 Running full audit on ${siteUrl}...\n`);
  
  try {
    const result = await runAudit(siteUrl);
    
    console.log('=== AUDIT CHECKS ===\n');
    
    // Filter and display Presence/Identity/Navigation checks  
    const relevantChecks = result.checks.filter(c => 
      c.key.includes('presence') || c.key.includes('navigation.home') || c.key.includes('navigation.about') || c.key.includes('navigation.contact')
    );
    
    console.log(`Total checks: ${result.checks.length}`);
    console.log(`Presence/Navigation checks: ${relevantChecks.length}\n`);
    
    console.log('=== STAGE 1 CHECKS ===');
    relevantChecks.forEach(check => {
      console.log(`[${check.status}] ${check.key}: "${check.item}" -> ${check.remarks}`);
    });
    
    console.log('\n✅ Audit complete!');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
})();
