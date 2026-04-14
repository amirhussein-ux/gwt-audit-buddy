// Test improved fuzzy matching functions
const {
  fuzzyMatchString,
  fuzzyMatchAny,
} = require('./src/audit/atoms/gwtHeuristics');

console.log('=== IMPROVED FUZZY MATCHING TESTS ===\n');

// Test 1: Exact substring match
console.log('Test 1: Exact substring match');
const result1 = fuzzyMatchString('about us', ['about', 'about us', 'profile']);
console.log('  Input: "about us", Targets: ["about", "about us", "profile"]');
console.log('  Result:', result1);
console.log('  ✓ PASS' + (result1.matched && result1.score >= 0.95 ? ' (score=' + result1.score + ')' : ' (FAILED)') + '\n');

// Test 2: "About Pasig" case (word-level matching)
console.log('Test 2: Word-level matching ("about pasig city")');
const result2 = fuzzyMatchString('about pasig city', ['about', 'about us', 'profile']);
console.log('  Input: "about pasig city", Targets: ["about", "about us", "profile"]');
console.log('  Result:', result2);
console.log('  ✓ PASS' + (result2.matched && result2.score >= 0.95 ? ' (score=' + result2.score + ')' : ' (FAILED)') + '\n');

// Test 3: "About Cainta" case
console.log('Test 3: Word-level matching ("about cainta")');
const result3 = fuzzyMatchString('about cainta', ['about', 'about us', 'profile']);
console.log('  Input: "about cainta", Targets: ["about", "about us", "profile"]');
console.log('  Result:', result3);
console.log('  ✓ PASS' + (result3.matched && result3.score >= 0.95 ? ' (score=' + result3.score + ')' : ' (FAILED)') + '\n');

// Test 4: Typo tolerance ("abot us")
console.log('Test 4: Typo tolerance ("abot us")');
const result4 = fuzzyMatchString('abot us', ['about', 'about us', 'profile']);
console.log('  Input: "abot us" (typo), Targets: ["about", "about us", "profile"]');
console.log('  Result:', result4);
console.log('  ✓ PASS' + (result4.matched ? ' (score=' + result4.score.toFixed(3) + ')' : ' (FAILED)') + '\n');

// Test 5: Contact matching
console.log('Test 5: Contact matching ("contact us", "contact information")');
const result5a = fuzzyMatchString('contact us', ['contact', 'contact us', 'get in touch', 'directory']);
const result5b = fuzzyMatchString('contact information', ['contact', 'contact us', 'get in touch', 'directory']);
console.log('  Input: "contact us", Targets: ["contact", ...]');
console.log('  Result:', result5a);
console.log('  Input: "contact information", Targets: ["contact", ...]');
console.log('  Result:', result5b);
console.log('  ✓ PASS' + (result5a.matched && result5b.matched ? '' : ' (FAILED)') + '\n');

// Test 6: Multiple candidates with fuzzyMatchAny
console.log('Test 6: Multiple candidates (fuzzyMatchAny)');
const candidates = ['home', 'about pasig city', 'services', 'news'];
const targets = ['about', 'about us', 'profile', 'organization'];
const result6 = fuzzyMatchAny(candidates, targets, 0.7);
console.log('  Candidates:', candidates);
console.log('  Targets:', targets);
console.log('  Result:', result6);
console.log('  ✓ PASS' + (result6 && result6.matched ? '' : ' (FAILED)') + '\n');

// Test 7: No match case
console.log('Test 7: No false positives');
const result7 = fuzzyMatchString('home page', ['about', 'contact', 'services']);
console.log('  Input: "home page", Targets: ["about", "contact", "services"]');
console.log('  Result:', result7);
console.log('  ✓ PASS' + (!result7.matched ? '' : ' (FAILED - should not match)') + '\n');

console.log('✅ All improved fuzzy matching tests completed!');

