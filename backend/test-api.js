const http = require('http');

const url = 'https://psa.gov.ph';

const postData = JSON.stringify({ url });

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/audit',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      if (result.results) {
        // Show first 20 results
        const results = result.results.slice(0, 20);
        results.forEach(r => {
          console.log(`${r.status}: ${r.key} - ${r.remarks.substring(0, 60)}`);
        });
        
        // Count by status
        const statusCount = {};
        result.results.forEach(r => {
          statusCount[r.status] = (statusCount[r.status] || 0) + 1;
        });
        
        console.log('\n=== Status Summary ===');
        Object.entries(statusCount).forEach(([status, count]) => {
          console.log(`${status}: ${count}`);
        });
      } else {
        console.log(data);
      }
    } catch (e) {
      console.log('Response:', data.substring(0, 200));
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem: ${e.message}`);
});

req.write(postData);
req.end();
