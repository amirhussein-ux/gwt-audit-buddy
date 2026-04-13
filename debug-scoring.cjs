const fs = require('node:fs/promises');
const path = require('node:path');

// Extract from reportGenerator.js
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function scoreFromStatus(status) {
  if (status === 'Pass') return 1;
  if (status === 'Partial') return 0.5;
  return 0; // Fail or N/A
}

function percentFromChecks(checks, stage) {
  if (!checks || checks.length === 0) {
    console.log(`  [${stage || 'Unknown'}] No checks provided - returning 0%`);
    return 0;
  }

  const scores = checks.map((check) => scoreFromStatus(check.status));
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  const percent = Math.round(average * 100);
  
  console.log(`  [${stage || 'Unknown'}] ${checks.length} checks, average score ${average.toFixed(2)}, ${percent}%`);
  return percent;
}

async function debug() {
  const mappingPath = path.join(__dirname, 'backend/src/config', 'Assessment Guidelines.csv');
  
  console.log('=== Audit Scoring Calculation Test ===\n');

  try {
    const raw = await fs.readFile(mappingPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const headerLine = lines[0];
    const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase());
    
    // Parse records
    const records = lines.slice(1)
      .filter(Boolean)
      .map((line) => {
        const values = parseCsvLine(line);
        const record = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });
        return {
          key: record.key || '',
          assessmentForm: record.assessmentform || '',
          assessmentStage: record.assessmentstage || '',
        };
      });
    
    console.log(`Loaded ${records.length} records\n`);
    
    // Simulate different scenarios
    console.log('=== Scenario 1: Website with all Stage 1 features ===');
    const stage1Keys = records
      .filter(m => m.assessmentForm.includes('Web Presence') && m.assessmentStage.includes('Stage 1'))
      .map(m => m.key);
    
    console.log(`Stage 1 has ${stage1Keys.length} mapped keys\n`);
    
    // If a website HAS all Stage 1 features, create passing checks
    const website1Checks = stage1Keys.slice(0, Math.ceil(stage1Keys.length * 0.8)).map(key => ({
      key,
      status: 'Pass',
    }));
    const missingChecks = stage1Keys.slice(Math.ceil(stage1Keys.length * 0.8));
    missingChecks.forEach(key => {
      website1Checks.push({ key, status: 'Fail' });
    });
    
    const Website1Stage1Score = percentFromChecks(website1Checks, 'Website1-Stage1');
    
    console.log(`\n=== Scenario 2: Same website with different distribution ===`);
    // Same website with 50% passing
    const website2Checks = stage1Keys.slice(0, Math.floor(stage1Keys.length * 0.5)).map(key => ({
      key,
      status: 'Pass',
    }));
    stage1Keys.slice(Math.floor(stage1Keys.length * 0.5)).forEach(key => {
      website2Checks.push({ key, status: 'Fail' });
    });
    
    const Website2Stage1Score = percentFromChecks(website2Checks, 'Website2-Stage1');
    
    console.log(`\n=== Test Result ===`);
    console.log(`Website 1 Stage 1: ${Website1Stage1Score}%`);
    console.log(`Website 2 Stage 1: ${Website2Stage1Score}%`);
    console.log(`Scores are different: ${Website1Stage1Score !== Website2Stage1Score ? '✓' : '✗'}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

debug();
