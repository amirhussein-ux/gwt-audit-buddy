const fs = require('node:fs/promises');
const path = require('node:path');

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

async function debug() {
  const mappingPath = path.join(__dirname, 'backend/src/config', 'Assessment Guidelines.csv');
  
  console.log('=== CSV Loading Debug ===\n');
  console.log('Expected path:', mappingPath);
  
  try {
    await fs.access(mappingPath);
    console.log('✓ CSV file exists\n');
  } catch (e) {
    console.log('✗ CSV file not found:', e.message);
    return;
  }

  try {
    const raw = await fs.readFile(mappingPath, 'utf8');
    console.log('File size:', raw.length, 'bytes');
    console.log('Charset: UTF-8\n');
    
    const lines = raw.split(/\r?\n/);
    console.log('Total lines (including header):', lines.length);
    
    const headerLine = lines[0];
    console.log('Header:', headerLine.substring(0, 100) + '...\n');
    
    const headers = parseCsvLine(headerLine);
    console.log('Parsed headers:', headers);
    console.log('Header count:', headers.length, '\n');
    
    // Check for assessmentStage header
    const hasAssessmentStageHeader = headers.some(h => h.toLowerCase().includes('assessmentstage') || h.toLowerCase().includes('stage'));
    console.log('Has assessmentStage header:', hasAssessmentStageHeader, '\n');
    
    // Find Stage 1 entries
    const stage1Lines = lines.slice(1).filter(line => line.includes('Stage 1'));
    console.log('Lines with "Stage 1":', stage1Lines.length);
    if (stage1Lines.length > 0) {
      console.log('Example Stage 1 line:\n', stage1Lines[0].substring(0, 150) + '...\n');
    }
    
    // Parse a few records
    console.log('=== Parsed Records Sample ===\n');
    const headerLower = headers.map(h => h.toLowerCase());
    
    for (let i = 1; i <= 3 && i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const record = {};
      headerLower.forEach((header, index) => {
        record[header] = values[index] || '';
      });
      
      console.log(`Record ${i}:`);
      console.log(`  key: ${record.key || record.id || ''}`);
      console.log(`  assessmentform: ${record.assessmentform || record.form || ''}`);
      console.log(`  assessmentstage: ${record.assessmentstage || record.stage || ''}`);
      console.log();
    }
    
    // Check Stage 1 filtering
    console.log('=== Stage 1 Filtering Test ===\n');
    const testRecords = [];
    for (let i = 1; i < Math.min(100, lines.length); i++) {
      const values = parseCsvLine(lines[i]);
      const record = {};
      headerLower.forEach((header, index) => {
        record[header] = values[index] || '';
      });
      testRecords.push({
        key: record.key || '',
        assessmentForm: record.assessmentform || '',
        assessmentStage: record.assessmentstage || '',
      });
    }
    
    // Filter for Stage 1
    const stage1Keys = testRecords
      .filter(m => m.assessmentForm?.includes('Web Presence') && m.assessmentStage?.includes('Stage 1'))
      .map(m => m.key);
    
    console.log('Stage 1 keys found:', stage1Keys.length);
    console.log('First 10 Stage 1 keys:', stage1Keys.slice(0, 10));
    console.log();
    
    // Filter for Stage 2
    const stage2Keys = testRecords
      .filter(m => m.assessmentForm?.includes('Web Presence') && m.assessmentStage?.includes('Stage 2'))
      .map(m => m.key);
    
    console.log('Stage 2 keys found:', stage2Keys.length);
    console.log('First 10 Stage 2 keys:', stage2Keys.slice(0, 10));
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

debug();
