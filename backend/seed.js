require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function seedDemoUser() {
  try {
    // Connect to MongoDB
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[Seed] ✓ Connected to MongoDB');

    // Check if demo user already exists and delete it
    const existingUser = await User.findOne({ email: 'user@dict.gov.ph' });
    if (existingUser) {
      await User.deleteOne({ email: 'user@dict.gov.ph' });
      console.log('[Seed] ℹ️  Removed old demo user');
    }

    // Create pre-verified demo user
    const demoUser = new User({
      username: 'demo_user',
      email: 'user@dict.gov.ph',
      hashedPassword: 'Temporary1234', // Will be auto-hashed by pre-save middleware
      role: 'auditor',
      isActive: true,
      isEmailVerified: true, // Pre-verified for demo
    });

    await demoUser.save();
    console.log('[Seed] ✓ Demo user created successfully');
    console.log('       Email: user@dict.gov.ph');
    console.log('       Password: Temporary1234');
    console.log('       Role: auditor');
    console.log('       Email Verified: YES');

    await mongoose.disconnect();
    console.log('[Seed] ✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('[Seed] ✗ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedDemoUser();
