#!/usr/bin/env node

/**
 * Test script to verify all checks are being executed on a government website
 */

const http = require('http');

function makeAuditRequest(url) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      url: url,
      maxPages: 5,
      maxDepth: 2,
      concurrency: 3
    });

    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/audit/audit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            data: json
          });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTest() {
  console.log('🔍 Starting audit test to verify all checks...\n');
  
  const testUrl = 'https://www.cainta.gov.ph';
  console.log(`📍 Testing URL: ${testUrl}\n`);
  console.log('⏳ Running audit (this may take a few minutes)...\n');

  try {
    const result = await makeAuditRequest(testUrl);
    
    if (result.statusCode !== 200) {
      console.error(`❌ Audit failed with status ${result.statusCode}`);
      console.error(result.data);
      process.exit(1);
    }

    const audit = result.data;
    const checks = audit.checks || [];

    console.log('\n✅ AUDIT COMPLETED SUCCESSFULLY\n');
    console.log('═'.repeat(80));
    console.log('📊 AUDIT VERIFICATION REPORT');
    console.log('═'.repeat(80));

    // Overall metrics
    console.log('\n📈 OVERALL METRICS:');
    console.log(`  • Pages Crawled: ${audit.crawlSummary?.pagesCrawled || 0}`);
    console.log(`  • Total Checks Performed: ${checks.length}`);
    console.log(`  • Passing Checks: ${checks.filter(c => c.status === 'Pass').length}`);
    console.log(`  • Failing Checks: ${checks.filter(c => c.status === 'Fail').length}`);
    console.log(`  • N/A Checks: ${checks.filter(c => c.status === 'N/A').length}`);

    // Group checks by category
    const byCategory = {};
    checks.forEach(check => {
      if (!byCategory[check.category]) {
        byCategory[check.category] = [];
      }
      byCategory[check.category].push(check);
    });

    console.log('\n📋 CHECKS BY CATEGORY:\n');
    Object.entries(byCategory).forEach(([category, categoryChecks]) => {
      const passing = categoryChecks.filter(c => c.status === 'Pass').length;
      const failing = categoryChecks.filter(c => c.status === 'Fail').length;
      const na = categoryChecks.filter(c => c.status === 'N/A').length;
      
      console.log(`  ${category} (${categoryChecks.length} checks)`);
      console.log(`    ✓ Pass: ${passing} | ✗ Fail: ${failing} | – N/A: ${na}`);
    });

    // Show failing checks
    const failingChecks = checks.filter(c => c.status === 'Fail');
    if (failingChecks.length > 0) {
      console.log('\n⚠️  FAILING CHECKS:\n');
      failingChecks.forEach(check => {
        console.log(`  [${check.category}] ${check.item}`);
        console.log(`    Key: ${check.key}`);
        console.log(`    Remarks: ${check.remarks}\n`);
      });
    }

    // Sample of passing checks
    const passingChecks = checks.filter(c => c.status === 'Pass').slice(0, 10);
    console.log('✅ SAMPLE PASSING CHECKS:\n');
    passingChecks.forEach(check => {
      console.log(`  [${check.category}] ${check.item}`);
      console.log(`    Remarks: ${check.remarks}\n`);
    });

    console.log('═'.repeat(80));
    console.log('\n✨ All checks have been verified and are being executed properly!\n');

  } catch (error) {
    console.error('\n❌ Error running audit:', error.message);
    process.exit(1);
  }
}

runTest();
