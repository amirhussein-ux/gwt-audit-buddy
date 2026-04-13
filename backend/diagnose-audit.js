#!/usr/bin/env node
/**
 * Audit Diagnostic Tool
 * Tests the complete audit flow and logs all data at each step
 */

const mongoose = require('mongoose');
const AuditLog = require('./src/models/AuditLog');
const { runAudit } = require('./src/services/auditEngine');

async function diagnosePreviousAudit() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gwt-audit-buddy';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected');

    // Get the most recent audit
    const latestAudit = await AuditLog.findOne().sort({ createdAt: -1 }).lean();

    if (!latestAudit) {
      console.log('❌ No audits found in database');
      process.exit(1);
    }

    console.log('\n📋 Latest Audit Found:');
    console.log(`   ID: ${latestAudit._id}`);
    console.log(`   URL: ${latestAudit.auditUrl}`);
    console.log(`   Status: ${latestAudit.status}`);
    console.log(`   Created: ${latestAudit.createdAt}`);

    console.log('\n📊 Audit Data Analysis:');
    console.log(`   Has auditResults: ${!!latestAudit.auditResults}`);
    console.log(`   Has auditResults.checks: ${!!latestAudit.auditResults?.checks}`);
    console.log(`   Checks count: ${latestAudit.auditResults?.checks?.length || 0}`);
    console.log(`   Has pageAudits: ${!!latestAudit.auditResults?.pageAudits}`);
    console.log(`   Page audits count: ${latestAudit.auditResults?.pageAudits?.length || 0}`);
    console.log(`   Has crawlSummary: ${!!latestAudit.auditResults?.crawlSummary}`);
    console.log(`   Pages crawled: ${latestAudit.auditResults?.crawlSummary?.pagesCrawled || latestAudit.performance?.pagesCrawled || 0}`);
    console.log(`   Has crawledPages array: ${!!latestAudit.crawledPages}`);
    console.log(`   Crawled pages count: ${latestAudit.crawledPages?.length || 0}`);

    console.log('\n🔍 Check Details (first 5):');
    const checks = latestAudit.auditResults?.checks || [];
    if (checks.length === 0) {
      console.log('   ⚠️  No checks found!');
    } else {
      checks.slice(0, 5).forEach((check, idx) => {
        console.log(`   ${idx + 1}. ${check.key} - ${check.status}`);
      });
      if (checks.length > 5) {
        console.log(`   ... and ${checks.length - 5} more checks`);
      }
    }

    console.log('\n✅ Summary:');
    if (checks.length === 0) {
      console.log('   ❌ PROBLEM: No checks generated in audit');
      console.log('   → Backend may not be running audit correctly');
      console.log('   → Check backend logs for errors');
    } else if (checks.length < 50) {
      console.log(`   ⚠️  WARNING: Only ${checks.length} checks (expected 100+)`);
      console.log('   → Some check builders may be failing');
    } else {
      console.log(`   ✅ Good: ${checks.length} checks generated`);
    }

    if (latestAudit.crawledPages?.length === 0) {
      console.log('   ❌ PROBLEM: No crawled pages stored');
      console.log('   → Crawl may have failed or completed in 0ms');
    } else {
      console.log(`   ✅ Good: ${latestAudit.crawledPages?.length || 0} pages crawled`);
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    process.exit(1);
  }
}

async function testNewAudit() {
  try {
    console.log('\n\n🧪 Testing new audit...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gwt-audit-buddy';
    await mongoose.connect(mongoUri);

    const testUrl = 'https://www.example.com';
    console.log(`Testing audit for: ${testUrl}`);
    console.log('This will take 30-60 seconds...\n');

    const startTime = Date.now();
    const auditResults = await runAudit(testUrl, { maxPages: 3, maxDepth: 1, concurrency: 2 });
    const duration = Date.now() - startTime;

    console.log(`✅ Audit completed in ${(duration / 1000).toFixed(1)}s\n`);

    console.log(`📊 Results:`);
    console.log(`   URL: ${auditResults.url}`);
    console.log(`   Checks generated: ${auditResults.checks?.length || 0}`);
    console.log(`   Pages audited: ${auditResults.pageAudits?.length || 0}`);
    console.log(`   Pages crawled: ${auditResults.crawlSummary?.pagesCrawled || 0}`);

    if (auditResults.checks.length === 0) {
      console.log('\n❌ PROBLEM: No checks generated');
    } else if (auditResults.checks.length < 50) {
      console.log(`\n⚠️  WARNING: Only ${auditResults.checks.length} checks (expected 100+)`);
    } else {
      console.log(`\n✅ SUCCESS: ${auditResults.checks.length} checks generated`);
    }

    console.log('\n🔍 First 10 checks:');
    auditResults.checks.slice(0, 10).forEach((check, idx) => {
      console.log(`   ${idx + 1}. ${check.key}: ${check.status}`);
    });

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

(async () => {
  await diagnosePreviousAudit();
  // Uncomment to test a new audit (takes 30-60 seconds)
  // await testNewAudit();
})();
