const mongoose = require('mongoose');
const AuditLog = require('./src/models/AuditLog');
const User = require('./src/models/User');
require('dotenv').config();

(async () => {
  try {
    console.log('[Fix] Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find the current logged-in user (demo user)
    const user = await User.findOne({ email: 'user@dict.gov.ph' });
    if (!user) {
      console.error('❌ Demo user not found (user@dict.gov.ph)');
      process.exit(1);
    }
    
    console.log('[Fix] Found user:', user.email, '(_id:', user._id, ')');
    
    // Update all audits without auditedBy
    console.log('[Fix] Updating audits without auditedBy...');
    const result = await AuditLog.updateMany(
      { auditedBy: null },
      { auditedBy: user._id }
    );
    
    console.log('✅ Updated audits:');
    console.log('   Matched:', result.matchedCount);
    console.log('   Modified:', result.modifiedCount);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
