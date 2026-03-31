const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('https://psa.gov.ph', { waitUntil: 'load', timeout: 30000 });
    
    const pageInfo = await page.evaluate(() => {
      const bodyText = document.body?.innerText || '';
      const bodyHtml = document.body?.innerHTML || '';
      
      return {
        // Phone patterns
        phoneMatches: bodyText.match(/\b\d{2,}-?\d{3,}-?\d{4,}\b/g) || [],
        phoneText: bodyText.match(/phone|tel:|contact/gi)?.slice(0, 5) || [],
        
        // Email patterns
        emailMatches: bodyText.match(/[\w.-]+@[\w.-]+\.\w+/g) || [],
        emailLinks: Array.from(document.querySelectorAll('a[href^="mailto:"]')).map(a => a.textContent),
        
        // Address patterns
        addressMatches: bodyText.match(/\b(street|avenue|blvd|road|address|city|province)\b/gi) || [],
        
        // Social networks
        socialLinks: Array.from(document.querySelectorAll('a')).filter(a => {
          const href = a.getAttribute('href') || '';
          const text = a.textContent?.toLowerCase() || '';
          return /facebook|twitter|linkedin|instagram|youtube|tiktok|pinterest/i.test(href + text);
        }).map(a => ({ text: a.textContent, href: a.getAttribute('href') })),
        
        // Logo/masthead analysis
        logoImages: Array.from(document.querySelectorAll('img')).filter(img => {
          const alt = img.getAttribute('alt')?.toLowerCase() || '';
          const src = img.getAttribute('src')?.toLowerCase() || '';
          return alt.includes('logo') || src.includes('logo') || src.includes('seal') || alt.includes('psa');
        }).map(img => ({ alt: img.getAttribute('alt'), src: img.getAttribute('src') })),
        
        // Navigation links
        navLinks: Array.from(document.querySelectorAll('nav a, header a')).map(a => ({
          text: a.textContent?.trim(),
          href: a.getAttribute('href'),
        })).slice(0, 15),
        
        // Forms
        formCount: document.querySelectorAll('form').length,
        
        // Links with 'contact' text
        contactLinks: Array.from(document.querySelectorAll('a')).filter(a => 
          /contact|phone|email|address|fax/i.test(a.textContent)
        ).map(a => ({ text: a.textContent, href: a.getAttribute('href') })),
      };
    });
    
    console.log('=== PAGE INFO FOR PSA.GOV.PH ===\n');
    console.log('Phone Matches:', pageInfo.phoneMatches.length > 0 ? pageInfo.phoneMatches : 'NONE');
    console.log('Phone Text Refs:', pageInfo.phoneText.length > 0 ? pageInfo.phoneText : 'NONE');
    console.log('\nEmail Matches:', pageInfo.emailMatches.length > 0 ? pageInfo.emailMatches : 'NONE');
    console.log('Email Links:', pageInfo.emailLinks.length > 0 ? pageInfo.emailLinks : 'NONE');
    console.log('\nAddress Matches:', pageInfo.addressMatches.length > 0 ? pageInfo.addressMatches.slice(0, 5) : 'NONE');
    console.log('\nSocial Links:', pageInfo.socialLinks.length > 0 ? pageInfo.socialLinks : 'NONE');
    console.log('\nLogo Images Found:', pageInfo.logoImages.length);
    if (pageInfo.logoImages.length > 0) {
      console.log('  ', pageInfo.logoImages.slice(0, 3));
    }
    console.log('\nTop Navigation Links:');
    pageInfo.navLinks.slice(0, 10).forEach(link => {
      console.log(`  ${link.text?.substring(0, 30)} -> ${link.href?.substring(0, 50)}`);
    });
    console.log('\nContact-Related Links:', pageInfo.contactLinks.length > 0 ? pageInfo.contactLinks : 'NONE');
    console.log('\nForms on page:', pageInfo.formCount);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
