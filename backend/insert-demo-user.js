/**
 * Insert Demo User with Proper Password Hashing
 * 
 * Run this script to properly insert the demo user with hashed password:
 * node backend/insert-demo-user.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function insertDemoUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Setup] Connected to MongoDB');

    // Check if demo user already exists
    const existingUser = await User.findOne({ email: 'user@dict.gov.ph' });
    
    if (existingUser) {
      console.log('[Setup] Demo user already exists');
      console.log(`[Setup] Updating password to ensure it's properly hashed...`);
      
      // Update with new password (will be hashed by pre-save middleware)
      existingUser.hashedPassword = 'Temporary123@';
      await existingUser.save();
      
      console.log('[Setup] ✓ Password updated and hashed');
    } else {
      // Create new demo user
      const demoUser = new User({
        username: 'Amir Macakiling',
        email: 'user@dict.gov.ph',
        hashedPassword: 'Temporary123@',  // Will be automatically hashed by User model
        role: 'admin',
      });

      await demoUser.save();
      console.log('[Setup] ✓ Demo user created with hashed password');
    }

    console.log('\n[Setup] ═══════════════════════════════════════════════════════');
    console.log('[Setup] Demo User Ready for Login');
    console.log('[Setup] ═══════════════════════════════════════════════════════\n');
    console.log('[Setup] Email: user@dict.gov.ph');
    console.log('[Setup] Password: Temporary123@');
    console.log('[Setup] Name: Amir Macakiling');
    console.log('[Setup] Role: admin (Full Access)\n');

    process.exit(0);
  } catch (error) {
    console.error('[Setup] Error:', error.message);
    process.exit(1);
  }
}

// Run
insertDemoUser();
