/**
 * Direct bcrypt test (no mongoose)
 */

const bcrypt = require('bcrypt');

async function testBcrypt() {
  try {
    const password = 'Temporary1234';
    
    console.log('Testing direct bcrypt...');
    console.log('Password:', password);
    
    // Hash the password
    const hash = await bcrypt.hash(password, 12);
    console.log('Generated hash:', hash);
    
    // Compare it
    const match = await bcrypt.compare(password, hash);
    console.log('Direct comparison result:', match);
    
    if (match) {
      console.log('✓ bcrypt is working correctly');
      console.log('\nHash to save in database:');
      console.log(hash);
    } else {
      console.log('✗ bcrypt comparison failed');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

testBcrypt();
