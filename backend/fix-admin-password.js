/**
 * Update admin user with verified working password hash
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function updatePassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Working hash generated and verified with bcrypt
    const workingHash = '$2b$12$ALVgwGsO6bBSuj54CZ/3zeJcFxyMrDs62G35TdiblL.PknV3Cwwky';

    const result = await mongoose.connection.db.collection('users').updateOne(
      { email: 'admin@dict.gov.ph' },
      { 
        $set: { 
          hashedPassword: workingHash,
          isActive: true,
          isEmailVerified: true,
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

    console.log('✓ Password updated successfully!');
    
    // Verify
    const user = await mongoose.connection.db.collection('users').findOne({ email: 'admin@dict.gov.ph' });
    console.log(`\n✓ Verification:`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - Username: ${user.username}`);
    console.log(`  - Active: ${user.isActive}`);
    console.log(`  - Email Verified: ${user.isEmailVerified}`);
    console.log(`  - Login Attempts: ${user.loginAttempts}`);
    console.log(`  - Locked Until: ${user.lockUntil || 'Not locked'}`);
    console.log(`  - Password Hash: ${user.hashedPassword.substring(0, 20)}...`);

    await mongoose.disconnect();
    console.log('\n✓ Ready to login!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

updatePassword();
