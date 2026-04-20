const mongoose = require('mongoose');
const AuditLog = require('./src/models/AuditLog');
const User = require('./src/models/User');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const audits = await AuditLog.find()
      .populate('auditedBy', 'email _id')
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log('Recent audits:');
    audits.forEach(audit => {
      console.log(`\n  URL: ${audit.auditUrl}`);
      console.log(`  Status: ${audit.status}`);
      console.log(`  Created: ${audit.createdAt}`);
      console.log(`  AuditedBy: ${audit.auditedBy ? audit.auditedBy.email : 'NULL'}`);
      console.log(`  AuditedBy ID: ${audit.auditedBy?._id || 'NULL'}`);
    });
    
    const currentUser = await User.findOne({ email: 'user@dict.gov.ph' });
    console.log(`\n\nCurrent user: user@dict.gov.ph`);
    console.log(`  _id: ${currentUser._id}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
