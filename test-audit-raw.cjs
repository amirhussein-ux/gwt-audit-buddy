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
  const testUrl = 'https://www.cainta.gov.ph';

  try {
    console.log('🔍 Making audit request...');
    const result = await makeAuditRequest(testUrl);
    
    console.log('\n📋 FULL API RESPONSE:');
    console.log(JSON.stringify(result.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runTest();
