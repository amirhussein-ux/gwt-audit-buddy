// Debug fuzzy matching
const Fuse = require('fuse.js');
const FUZZY_THRESHOLD = 0.7;

// Test individual candidate matching
const candidates = ['Our Company', 'The Services', 'Contact Info'];
const targets = ['about', 'contact', 'services'];

console.log('=== Testing Individual Candidates ===\n');

for (const candidate of candidates) {
  console.log(`Candidate: "${candidate}"`);
  
  const fuse = new Fuse(targets, {
    threshold: 1 - FUZZY_THRESHOLD,
    useExtendedSearch: true,
    includeScore: true,
  });
  
  const results = fuse.search(candidate);
  console.log(`Results (threshold=${1 - FUZZY_THRESHOLD}):`, results);
  
  if (results.length > 0) {
    const bestScore = results[0].score;
    const matchedTarget = results[0].item;
    const similarity = 1 - bestScore;
    console.log(`  ✓ Best match: "${matchedTarget}" (similarity: ${similarity.toFixed(3)})`);
  } else {
    console.log('  ✗ No matches found');
  }
  console.log('');
}

console.log('=== Alternative: Full Text Search ===\n');

// Try lowercase
console.log('Lowercase "contact info" vs targets:');
const fuse = new Fuse(targets, {
  threshold: 1 - FUZZY_THRESHOLD,
  includeScore: true,
});

const results = fuse.search('contact info');
console.log('Results:', results);
