// This script clears the stuck audit from browser localStorage
// Run this in the browser console:

// Clear active audit
localStorage.removeItem('activeAudit');
localStorage.removeItem('lastAuditResult');
localStorage.removeItem('auditSteps');

console.log('✅ Cleared stuck audit from localStorage. Refresh the page now.');
