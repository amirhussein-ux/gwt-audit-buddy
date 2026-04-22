/**
 * Unlock admin account (reset login attempts and lockUntil)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function unlockAccount() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Unlock admin account
    const result = await User.updateOne(
      { email: 'admin@dict.gov.ph' },
      { 
        $set: { 
          loginAttempts: 0, 
          lockUntil: null 
        } 
      }
    );

    if (result.modifiedCount === 0) {
      console.log('⚠ No user found with email admin@dict.gov.ph');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('✓ Account unlocked successfully!');
    
    // Verify
    const user = await User.findOne({ email: 'admin@dict.gov.ph' });
    console.log(`\n✓ Verification:`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - Username: ${user.username}`);
    console.log(`  - Login Attempts: ${user.loginAttempts}`);
    console.log(`  - Locked Until: ${user.lockUntil || 'Not locked'}`);

    await mongoose.disconnect();
    console.log('\n✓ Ready to login!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

unlockAccount();
