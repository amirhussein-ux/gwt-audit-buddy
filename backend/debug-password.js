/**
 * Debug password verification
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./src/models/User');

async function debugPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    const user = await User.findOne({ email: 'admin@dict.gov.ph' }).select('+hashedPassword');
    
    if (!user) {
      console.log('✗ User not found');
      process.exit(1);
    }

    console.log('User found:', user.email);
    console.log('Username:', user.username);
    console.log('Role:', user.role);
    console.log('Email Verified:', user.isEmailVerified);
    console.log('Active:', user.isActive);
    console.log('Hashed Password stored:', user.hashedPassword.substring(0, 20) + '...');

    // Test password comparison
    const testPassword = 'Temporary1234';
    console.log(`\nTesting password: "${testPassword}"`);
    
    const isMatch = await bcrypt.compare(testPassword, user.hashedPassword);
    console.log('Password match result:', isMatch);

    if (!isMatch) {
      console.log('\n✗ Password does NOT match!');
      console.log('The stored hash might be corrupted or hashed with a different package.');
      
      // Try to rehash it
      console.log('\nRehashing password...');
      const newHash = await bcrypt.hash(testPassword, 12);
      user.hashedPassword = newHash;
      await user.save();
      
      console.log('✓ Password rehashed and saved');
      
      // Test again
      const isMatchAfter = await bcrypt.compare(testPassword, user.hashedPassword);
      console.log('Password match after rehash:', isMatchAfter);
    } else {
      console.log('✓ Password matches correctly!');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

debugPassword();
