/**
 * Detailed Test Script: Auto Agency Creation
 * 
 * Purpose: Debug the auto-agency-creation feature and check the full response
 */

const http = require('http');

const TEST_URL = 'https://cainta.gov.ph';

console.log('\n🔍 Detailed Auto-Agency-Creation Test');
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
  timeout: 10 * 60 * 1000, // 10 minute timeout
};

const startTime = Date.now();
const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r⏱️  Audit in progress... ${elapsed}s`);
  });

  res.on('end', () => {
    console.log('\n');
    
    if (res.statusCode === 200) {
      try {
        const response = JSON.parse(data);
        
        console.log('✅ Response Received (HTTP 200)\n');
        
        console.log('📋 FULL RESPONSE KEYS:');
        console.log(JSON.stringify(Object.keys(response), null, 2));
        console.log();
        
        // Log agency section
        console.log('🏛️  Agency Section:');
        console.log(JSON.stringify(response.agency, null, 2));
        console.log();
        
        // Log auditResults keys
        console.log('📊 Audit Results Keys:');
        if (response.auditResults) {
          console.log(JSON.stringify(Object.keys(response.auditResults), null, 2));
          console.log();
          
          // Log page data
          if (response.auditResults.pageAudits) {
            console.log(`✓ pageAudits: ${response.auditResults.pageAudits.length} pages`);
          }
          if (response.auditResults.pageScores) {
            console.log(`✓ pageScores: ${response.auditResults.pageScores.length} scores`);
          }
          if (response.auditResults.totalChecks) {
            console.log(`✓ totalChecks: ${response.auditResults.totalChecks}`);
            console.log(`  - Passing: ${response.auditResults.passingChecks}`);
            console.log(`  - Failing: ${response.auditResults.failingChecks}`);
            console.log(`  - N/A: ${response.auditResults.naChecks}`);
          }
        }
        
      } catch (e) {
        console.log('❌ Error parsing response:', e.message);
        console.log('First 1000 chars of response:', data.substring(0, 1000));
      }
    } else {
      console.log(`❌ Error: HTTP ${res.statusCode}`);
      try {
        const error = JSON.parse(data);
        console.log('Error details:', error);
      } catch (e) {
        console.log('Response:', data.substring(0, 500));
      }
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
  if (e.code === 'ECONNREFUSED') {
    console.error('   → Backend server is not running');
  }
});

req.on('timeout', () => {
  req.abort();
  console.error('❌ Request timed out after 10 minutes');
});

req.write(postData);
req.end();
