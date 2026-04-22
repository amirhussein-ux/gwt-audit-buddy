const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('? Connected to MongoDB');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('\nAvailable collections:', collections.map(c => c.name));

    // Check each collection for document count
    const Audit = require('./src/models/Audit');
    const auditCount = await Audit.countDocuments();
    console.log('\nAudit documents count:', auditCount);

    // List first few audits if any
    if (auditCount > 0) {
      const audits = await Audit.find().limit(5);
      console.log('\nFirst audits:', JSON.stringify(audits, null, 2));
    } else {
      console.log('No audit documents found in database');
    }

    await mongoose.disconnect();
    console.log('\n? Disconnected from MongoDB');
  } catch (error) {
    console.error('? Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkDatabase();
