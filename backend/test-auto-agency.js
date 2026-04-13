/**
 * Test Script: Auto Agency Creation
 * 
 * Purpose: Verify that auditing an unknown government website URL
 * automatically creates a new Agency record
 */

const http = require('http');

// Test with a government website URL
// Using cainta.gov.ph which is known to be accessible and working
const TEST_URL = 'https://cainta.gov.ph';

console.log('\n🔍 Testing Auto-Agency-Creation Feature');
console.log('═'.repeat(50));
console.log(`Test URL: ${TEST_URL}`);
console.log('═'.repeat(50));

const postData = JSON.stringify({
  url: TEST_URL,
});

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/audit/audit',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
  timeout: 10 * 60 * 1000, // 10 minute timeout for actual audit
};

const startTime = Date.now();
const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
    // Log progress for long-running audits
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r⏱️  Audit in progress... ${elapsed}s`);
  });

  res.on('end', () => {
    console.log('\n');
    
    if (res.statusCode === 200) {
      try {
        const response = JSON.parse(data);
        
        console.log('✅ Audit Completed Successfully!\n');
        
        // Check agency creation info
        if (response.agency) {
          console.log('📋 Agency Information:');
          console.log(`   Name: ${response.agency.name}`);
          console.log(`   Domain: ${response.agency.domainUrl}`);
          console.log(`   Was Created: ${response.agency.wasCreated}`);
          console.log(`   Message: ${response.agency.message}\n`);
        } else {
          console.log('⚠️  No agency linked to audit\n');
        }
        
        // Check audit results
        if (response.auditResults) {
          console.log('📊 Audit Results:');
          console.log(`   Pages Crawled: ${response.auditResults.pageAudits?.length || 0}`);
          console.log(`   Pages Audited: ${response.auditResults.pageScores?.length || 0}`);
          console.log(`   Total Checks: ${response.auditResults.totalChecks}`);
          console.log(`   Passing: ${response.auditResults.passingChecks}`);
          console.log(`   Failing: ${response.auditResults.failingChecks}`);
          console.log(`   N/A: ${response.auditResults.naChecks}\n`);
        }
        
        console.log('📁 Downloads Generated:');
        console.log(`   ✓ XLSX (${response.downloads?.xlsx?.filename})`);
        console.log(`   ✓ PDF (${response.downloads?.pdf?.filename})\n`);
        
      } catch (e) {
        console.log('❌ Error parsing response:', e.message);
        console.log('Raw response:', data.substring(0, 500));
      }
    } else {
      console.log(`❌ Error: HTTP ${res.statusCode}`);
      try {
        const error = JSON.parse(data);
        console.log('Error details:', error);
      } catch (e) {
        console.log('Response:', data);
      }
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
  if (e.code === 'ECONNREFUSED') {
    console.error('   → Backend server is not running');
    console.error('   → Start it with: cd backend && npm run dev');
  }
});

req.on('timeout', () => {
  req.abort();
  console.error('❌ Request timed out after 10 minutes');
});

req.write(postData);
req.end();
