/**
 * Create Admin Demo User
 * username: BossAko
 * email: admin@dict.gov.ph
 * password: Temporary1234
 * role: admin
 * isEmailVerified: true
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./src/models/User');

async function createAdminUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: 'admin@dict.gov.ph' },
        { username: 'BossAko' }
      ]
    });

    if (existingUser) {
      console.log('⚠ User already exists:', existingUser.email);
      console.log('  Updating...');
      
      // Update existing user
      existingUser.username = 'BossAko';
      existingUser.email = 'admin@dict.gov.ph';
      existingUser.hashedPassword = await bcrypt.hash('Temporary1234', 12);
      existingUser.role = 'admin';
      existingUser.isEmailVerified = true;
      
      await existingUser.save();
      console.log('✓ User updated successfully!');
    } else {
      // Create new admin user
      const hashedPassword = await bcrypt.hash('Temporary1234', 12);
      
      const adminUser = new User({
        username: 'BossAko',
        email: 'admin@dict.gov.ph',
        hashedPassword: hashedPassword,
        role: 'admin',
        isEmailVerified: true,
      });

      await adminUser.save();
      console.log('✓ Admin user created successfully!');
    }

    // Verify the user was created/updated
    const user = await User.findOne({ email: 'admin@dict.gov.ph' });
    console.log('\n✓ Verification:');
    console.log(`  Username: ${user.username}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Email Verified: ${user.isEmailVerified}`);

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

createAdminUser();

