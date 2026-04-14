// Test improved regex patterns
const patterns = {
  about: /\babout\b|\bprofile\b|\bhistory\b|\bmandate\b|\bbackground\b|\bwho\s+we\s+are\b|\bagency\s+info\b/i,
  contact: /\bcontact\b|\bget\s+in\s+touch\b|\breach\s+us\b|\bdirectory\b|\binquiries\b|\bhelp\b|\bsupport\b|\boffices?\b/i,
};

console.log('=== TESTING IMPROVED REGEX PATTERNS ===\n');

const testCases = [
  { text: 'About Cainta', intent: 'about', shouldMatch: true },
  { text: 'About Pasig City', intent: 'about', shouldMatch: true },
  { text: 'About Us', intent: 'about', shouldMatch: true },
  { text: 'Profile', intent: 'about', shouldMatch: true },
  { text: 'Our Agency Profile', intent: 'about', shouldMatch: true },
  { text: 'Contact Us', intent: 'contact', shouldMatch: true },
  { text: 'Contact Information', intent: 'contact', shouldMatch: true },
  { text: 'Get In Touch', intent: 'contact', shouldMatch: true },
  { text: 'Reach Us', intent: 'contact', shouldMatch: true },
  { text: 'Office Directory', intent: 'contact', shouldMatch: true },
  { text: 'Home', intent: 'about', shouldMatch: false },
  { text: 'Services', intent: 'about', shouldMatch: false },
  { text: 'News & Events', intent: 'contact', shouldMatch: false },
];

testCases.forEach((test, idx) => {
  const pattern = patterns[test.intent];
  const matches = pattern.test(test.text);
  const status = matches === test.shouldMatch ? '✓' : '✗';
  console.log(`${status} Test ${idx + 1}: "${test.text}" (${test.intent}) → ${matches ? 'MATCH' : 'NO MATCH'} (expected: ${test.shouldMatch ? 'MATCH' : 'NO MATCH'})`);
});

console.log('\n✅ Regex pattern tests completed!');
