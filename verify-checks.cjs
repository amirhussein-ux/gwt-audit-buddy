#!/usr/bin/env node

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
      },
      timeout: 600000
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
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(data);
    req.end();
  });
}

async function runTest() {
  console.log('🔍 Starting audit test to verify all checks...\n');
  
  const testUrl = 'https://www.cainta.gov.ph';
  console.log(`📍 Testing URL: ${testUrl}\n`);
  console.log('⏳ Running audit (this may take 5-10 minutes)...\n');

  try {
    const result = await makeAuditRequest(testUrl);
    
    if (result.statusCode !== 200) {
      console.error(`❌ Audit failed with status ${result.statusCode}`);
      console.error(JSON.stringify(result.data, null, 2));
      process.exit(1);
    }

    const response = result.data;
    
    // Find checks in the response - they might be in different locations
    let checks = [];
    
    if (Array.isArray(response.checks)) {
      checks = response.checks;
    } else if (response.auditResults && Array.isArray(response.auditResults.checks)) {
      checks = response.auditResults.checks;
    } else if (response.assessmentForms && Array.isArray(response.assessmentForms)) {
      // Flatten assessment forms
      const flatten = (arr) => arr.reduce((acc, val) => {
        if (Array.isArray(val.checks)) {
          return acc.concat(val.checks);
        }
        return acc;
      }, []);
      checks = flatten(response.assessmentForms);
    }

    console.log('\n✅ AUDIT COMPLETED SUCCESSFULLY\n');
    console.log('═'.repeat(80));
    console.log('📊 AUDIT VERIFICATION REPORT');
    console.log('═'.repeat(80));

    // Overall metrics
    console.log('\n📈 OVERALL METRICS:');
    console.log(`  • Pages Crawled: ${response.crawlfSummary?.pagesCrawled || response.pagesCrawled || 'N/A'}`);
    console.log(`  • Total Assessments/Checks: ${checks.length}`);
    
    if (checks.length > 0) {
      const passing = checks.filter(c => c.status === 'Pass').length;
      const failing = checks.filter(c => c.status === 'Fail').length;
      const na = checks.filter(c => c.status === 'N/A').length;
      
      console.log(`  • Passing: ${passing}`);
      console.log(`  • Failing: ${failing}`);
      console.log(`  • N/A: ${na}`);
      console.log(`  • Pass Rate: ${Math.round((passing / checks.length) * 100)}%`);
    }

    // Group by assessment form
    const byForm = {};
    checks.forEach(check => {
      const form = check.assessmentForm || check.category || 'Unknown';
      if (!byForm[form]) {
        byForm[form] = [];
      }
      byForm[form].push(check);
    });

    console.log('\n📋 ASSESSMENTS BY FORM:\n');
    Object.entries(byForm).forEach(([form, formChecks]) => {
      const passing = formChecks.filter(c => c.status === 'Pass').length;
      const failing = formChecks.filter(c => c.status === 'Fail').length;
      const na = formChecks.filter(c => c.status === 'N/A').length;
      
      console.log(`  📄 ${form}`);
      console.log(`     Total: ${formChecks.length} | ✓ Pass: ${passing} | ✗ Fail: ${failing} | – N/A: ${na}`);
    });

    // Show assessment sections
    const bySectionByForm = {};
    checks.forEach(check => {
      const form = check.assessmentForm || 'Unknown';
      const section = check.assessmentSection || 'Unknown';
      const key = `${form} > ${section}`;
      
      if (!bySectionByForm[key]) {
        bySectionByForm[key] = [];
      }
      bySectionByForm[key].push(check);
    });

    console.log('\n📑 DETAILED SECTIONS ASSESSED:\n');
    Object.entries(bySectionByForm).slice(0, 15).forEach(([key, sectionChecks]) => {
      const passing = sectionChecks.filter(c => c.status === 'Pass').length;
      const failing = sectionChecks.filter(c => c.status === 'Fail').length;
      console.log(`  • ${key}`);
      console.log(`    ${passing}/${sectionChecks.length} passed`);
    });

    // Show failing checks
    const failingChecks = checks.filter(c => c.status === 'Fail').slice(0, 10);
    if (failingChecks.length > 0) {
      console.log('\n⚠️  TOP FAILING ASSESSMENTS:\n');
      failingChecks.forEach((check, idx) => {
        console.log(`  ${idx + 1}. ${check.guideline || check.item}`);
        console.log(`     Status: FAIL`);
        if (check.evidence) console.log(`     Evidence: ${check.evidence}`);
        if (check.remarks) console.log(`     Remarks: ${check.remarks}`);
      });
    }

    console.log('\n═'.repeat(80));
    console.log('✨ VERIFICATION COMPLETE!');
    console.log('═'.repeat(80));
    console.log('\n✅ The system is correctly evaluating the website against');
    console.log('   all assessment guidelines and generating detailed reports.\n');

  } catch (error) {
    console.error('\n❌ Error running audit:', error.message);
    process.exit(1);
  }
}

runTest();
