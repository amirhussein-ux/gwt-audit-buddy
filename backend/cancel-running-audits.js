const mongoose = require('mongoose');
const AuditLog = require('./src/models/AuditLog');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('[Cancel] Finding running audits...');
    const running = await AuditLog.find({ status: 'in_progress' })
      .sort({ createdAt: -1 });
    
    if (running.length === 0) {
      console.log('ℹ️  No running audits found');
      process.exit(0);
    }
    
    console.log(`Found ${running.length} running audit(s):\n`);
    running.forEach((audit, idx) => {
      console.log(`${idx + 1}. URL: ${audit.auditUrl}`);
      console.log(`   ID: ${audit._id}`);
      console.log(`   Started: ${audit.createdAt}\n`);
    });
    
    // Cancel all running audits
    const result = await AuditLog.updateMany(
      { status: 'in_progress' },
      { 
        status: 'cancelled',
        auditResults: { error: 'Audit cancelled by user' }
      }
    );
    
    console.log(`✅ Cancelled ${result.modifiedCount} audit(s)`);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
