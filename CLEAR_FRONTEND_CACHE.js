/**
 * Frontend Cache Clearer
 * 
 * Run this in the browser console (F12) to clear stale audit data:
 * 
 * 1. Open your browser DevTools (F12)
 * 2. Go to the Console tab
 * 3. Paste and run this entire code
 */

(function clearAuditCache() {
  console.log('🧹 Clearing stale audit cache...');
  
  // Clear localStorage
  const keysToRemove = [
    'lastAuditResult',
    'audit',
    'auditResults',
    'auditData',
    'auditCache',
  ];
  
  keysToRemove.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`✅ Removed localStorage.${key}`);
    }
  });
  
  // Clear sessionStorage
  Object.keys(sessionStorage).forEach(key => {
    if (key.includes('audit') || key.includes('result')) {
      sessionStorage.removeItem(key);
      console.log(`✅ Removed sessionStorage.${key}`);
    }
  });
  
  // Clear service worker cache (if present)
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName).then(() => {
          console.log(`✅ Cleared cache: ${cacheName}`);
        });
      });
    });
  }
  
  console.log('🎉 Cache cleared! Now reload the page (F5 or Ctrl+R)');
  console.log('\n📝 Next steps:');
  console.log('1. Reload this page (F5)');
  console.log('2. Go to Dashboard');
  console.log('3. Start a new audit');
  console.log('4. Results should now show 100+ checks instead of 0%');
})();
