/**
 * Fix script: Set isArchived: false on all existing audits that don't have this field
 * Run this once to migrate existing data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AuditLog = require('./src/models/AuditLog');

async function fixAuditArchiveField() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Update all audits that don't have isArchived field (set to false)
    const result = await AuditLog.updateMany(
      { isArchived: { $exists: false } },
      { $set: { isArchived: false } }
    );

    console.log(`\n✓ Migration complete!`);
    console.log(`  - Updated ${result.modifiedCount} audits`);
    console.log(`  - Matched ${result.matchedCount} documents`);

    // Verify the fix
    const allAudits = await AuditLog.countDocuments();
    const archivedAudits = await AuditLog.countDocuments({ isArchived: true });
    const activeAudits = await AuditLog.countDocuments({ isArchived: { $ne: true } });

    console.log(`\n✓ Verification:`);
    console.log(`  - Total audits: ${allAudits}`);
    console.log(`  - Active audits (showing in main list): ${activeAudits}`);
    console.log(`  - Archived audits: ${archivedAudits}`);

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error during migration:', error);
    process.exit(1);
  }
}

fixAuditArchiveField();
