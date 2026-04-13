const http = require('http');

const backendUrl = 'http://localhost:4000';
const adminToken = process.env.ADMIN_TOKEN || 'test-token';

// Test URLs that should have different characteristics
const testUrls = [
  'https://www.google.com', // Tech company site (should have search, RSS, etc.)
  'https://www.gov.ph',      // Government site (should have PST, transparency seal)
  'https://www.github.com',  // Developer site (should have documentation, forms)
];

async function startAudit(url, index) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/audit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ index, url, auditLogId: parsed.auditLogId, status: res.statusCode });
        } catch (e) {
          reject({ index, url, error: e.message, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (err) => {
      reject({ index, url, error: err.message });
    });

    const body = JSON.stringify({
      url: url,
      maxPages: 5,
      maxDepth: 2,
      concurrency: 2,
    });

    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== GWT Audit Test - Multiple URLs ===\n');
  console.log('This test will start audits on multiple URLs and let them process');
  console.log('Check the backend server logs for scoring output\n');

  console.log('Starting audits...');
  for (let i = 0; i < testUrls.length; i++) {
    try {
      const result = await startAudit(testUrls[i], i);
      console.log(`[${i+1}] Started: ${result.url}`);
      console.log(`    Audit ID: ${result.auditLogId}`);
      console.log(`    Status: ${result.status}\n`);
    } catch (err) {
      console.log(`[${i+1}] Failed: ${err.url}`);
      console.log(`    Error: ${err.error}`);
      if (err.statusCode) console.log(`    HTTP: ${err.statusCode}`);
      console.log();
    }
  }

  console.log('Audits submitted! Watch the backend server logs for scoring output.');
  console.log('Background processing may take several minutes per URL.');
}

main().catch(console.error);
