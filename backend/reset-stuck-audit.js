const mongoose = require('mongoose');
const AuditLog = require('./src/models/AuditLog');
require('dotenv').config();

(async () => {
  try {
    console.log('[Reset] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('[Reset] Finding stuck audits...');
    const result = await AuditLog.findOneAndUpdate(
      { status: 'in_progress' },
      { status: 'failed', auditResults: { error: 'Audit timeout - marked as failed' } },
      { new: true }
    );
    
    if (result) {
      console.log('✅ Stuck audit marked as failed:', result._id);
      console.log('   URL:', result.auditUrl);
    } else {
      console.log('ℹ️  No stuck audits found');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
