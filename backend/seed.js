/**
 * Seed Script for MASID Database
 * Initializes database with sample Philippine government agencies and default admin user
 * 
 * Usage: node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const DEFAULT_ADMIN = {
  username: 'admin',
  email: 'admin@masid.dict.gov.ph',
  hashedPassword: 'changeme123', // Will be hashed automatically
  role: 'admin',
};

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('[Seed] Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ username: 'admin' });
    if (!existingAdmin) {
      const admin = new User(DEFAULT_ADMIN);
      await admin.save();
      console.log('[Seed] ✓ Created default admin user');
      console.log(`    Username: ${DEFAULT_ADMIN.username}`);
      console.log(`    Email: ${DEFAULT_ADMIN.email}`);
      console.log(`    Password: ${DEFAULT_ADMIN.hashedPassword}`);
      console.log(`    ⚠️  CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION!`);
    } else {
      console.log('[Seed] Admin user already exists, skipping');
    }

    console.log('\n[Seed] ✓ Database seeding completed!');
    console.log('[Seed] Ready to scan actual government websites');
    console.log('[Seed] Start the server: npm start');

    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error:', error.message);
    console.error('[Seed] Stack:', error.stack);
    process.exit(1);
  }
}

// Run seeding
seedDatabase();
