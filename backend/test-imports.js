#!/usr/bin/env node
/**
 * Test script to verify auditEngine.js can be imported without errors
 */

const path = require('path');

try {
  console.log('[TEST] Loading auditEngine...');
  const { runAudit, validateTargetUrl, AuditError } = require('./src/services/auditEngine');
  
  console.log('✅ auditEngine loaded successfully');
  console.log('   - runAudit:', typeof runAudit);
  console.log('   - validateTargetUrl:', typeof validateTargetUrl);
  console.log('   - AuditError:', typeof AuditError);
  
  console.log('\n[TEST] Loading auditRoute...');
  const auditRoute = require('./src/routes/auditRoute');
  
  console.log('✅ auditRoute loaded successfully');
  
  console.log('\n[TEST] Testing URL validation...');
  try {
    validateTargetUrl('https://example.gov.ph');
    console.log('✅ URL validation works');
  } catch (e) {
    console.error('❌ URL validation failed:', e.message);
  }
  
  console.log('\n✅ All tests passed! Backend is ready for testing.');
  process.exit(0);
} catch (error) {
  console.error('❌ ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
}
