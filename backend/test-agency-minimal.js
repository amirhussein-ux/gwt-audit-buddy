/**
 * Minimal test for agency field in response
 */

const http = require('http');

const postData = JSON.stringify({ url: 'https://cainta.gov.ph' });

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/audit/audit',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
  timeout: 10 * 60 * 1000,
};

const startTime = Date.now();
const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r⏱️  ${elapsed}s`);
  });

  res.on('end', () => {
    console.log('\n');
    
    try {
      const response = JSON.parse(data);
      
      console.log('Response top-level keys:', Object.keys(response).join(', '));
      console.log();
      
      // Check if agency exists
      console.log('agency field exists?', 'agency' in response);
      console.log('agency value:', response.agency);
      console.log();
      
      // Check downloads size
      const xlsxSize = response.downloads?.xlsx?.base64?.length || 0;
      const pdfSize = response.downloads?.pdf?.base64?.length || 0;
      console.log(`Downloads sizes: XLSX=${(xlsxSize/1024/1024).toFixed(2)}MB, PDF=${(pdfSize/1024/1024).toFixed(2)}MB`);
      console.log();
      
      // Show first 500 chars
      console.log('Response start:', JSON.stringify(response).substring(0, 500));
      
    } catch (e) {
      console.log('Parse error:', e.message);
      console.log('Response first 500 chars:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();
