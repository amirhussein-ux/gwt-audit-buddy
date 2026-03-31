# Audit Coverage Analysis

## Summary
The system is **displaying 107 assessment items** across both forms, but **only performing 17-18 automated checks**. This means **~89 items show as "N/A"** in audit results.

### Coverage Rate: 17/107 (16%)

---

## Checks Currently Implemented

### Performance (1 check)
- [x] `performance.avg_load_time` - Average page load time across 3 trials

### Technical Accessibility (4 checks)
- [x] `a11y.image_alt` - Image ALT text (Axe-core)
- [x] `a11y.color_contrast` - Color contrast (Axe-core)
- [x] `a11y.form_labels` - Form input labels (Axe-core)
- [x] `a11y.descriptive_links` - Avoid "Click Here" links

### Presence & Identity (6 checks)
- [x] `presence.pst` - Philippine Standard Time in masthead
- [x] `presence.logo_home` - Logo links to homepage
- [x] `presence.transparency_seal_link` - Transparency Seal exists & links
- [x] `presence.breadcrumbs` - Breadcrumb navigation
- [x] `presence.govph_link` - GovPH link in top menu
- [x] `presence.menu_consistency` - Menu signature consistency

### Navigation (2 checks)
- [x] `navigation.about_link` - About Us link present
- [x] `navigation.contact_link` - Contact link present

### Error Handling (1 check)
- [x] `error.custom_404` - Custom 404 page

### Semantic Content (3 checks)
- [x] `semantic.tagline_clear` - Tagline clarity (requires Gemini API)
- [x] `semantic.whitespace_layout` - Homepage white space (requires Gemini API)
- [x] `semantic.about_contact_top` - About/Contact placement

---

## Tests NOT Currently Implemented (N/A Results)

### Web Usability - Accessibility (Missing: 13 items)
- Navigation signals (home link accessible, about/contact/home easy to find, back to homepage)
- Content signals (tags/descriptions, readability, relevance, terminology, language tone, legibility, font spacing, flash/addons, link clarity)

### Web Usability - Identity (Missing: 5 items)
- Logo featured detection
- Logo home link validation  
- Logo size compliance
- Tagline purpose clarity
- Homepage digestibility timing

### Web Usability - Navigation (Missing: 9 items)
- Site access ease, back to homepage, sitemap/structure, navigation scheme, structure understanding
- Tags/meta clarity, button/link count, mobile viewability, logo homepage link

### Web Usability - Content (Missing: 15 items)
- Headings/titles/headers/URLs descriptive check
- Critical content above fold & visibility
- Color contrast as sole method, link color distinction
- Emphasis usage, seizure/flashing content, copy clarity, page titles
- Company info & contact info accessibility (4+6 items combined)

### Web Presence - Emerging Stage (Missing: 16 items, ~70% of Stage 1)
All presence items beyond basic detection are not checked:
- Organization structure, key officials, contact details in form
- Citizens Charter, mission/vision, objectives, mandate, products, plans, policies, outputs
- Downloads, archives, FAQs, opportunities, announcements

### Web Presence - Enhanced Stage (Missing: 1 item)
- Search function & sitemap

### Web Presence - Transactional Stage (Missing: 12 items)
- e-Services, SSL, Privacy Policy, CAPTCHA
- RSS, e-Participation forms, email alerts, downloadable docs, e-Signature
- User login, request confirmation, online forms

### Web Presence - Connected Stage (Missing: 14 items)
- e-participation policy, upcoming activities, archived info
- Discussion forums, surveys, polls, blogs, social networks
- Bulletin boards, chat, webcasting
- Citizen feedback collection, results publication, response archive

---

## Gap Analysis by Category

| Form | Total Items | Automated | N/A | Coverage |
|------|-------------|-----------|-----|----------|
| **Web Usability** | 55 | 10 | 45 | 18% |
| **Web Presence** | 52 | 7 | 45 | 13% |
| **TOTAL** | **107** | **17** | **90** | **16%** |

---

## Detailed Check Locations

**Only Running:**
- Location: `backend/src/services/auditEngine.js` (lines 326-475)
- Function: `runAudit()` aggregates checks from:
  - `buildAccessibilityChecks()` from gwtChecker.js
  - `buildPresenceIdentityChecks()` from gwtChecker.js
  - `buildPerformanceCheckFromTrials()` from gwtChecker.js
  - `buildCustom404Check()` from gwtChecker.js
  - `runSemanticEvaluation()` from semanticEvaluator.js

**Mapping Only (No Checks):**
- All 90 items in CSV that don't have corresponding check functions
- These will appear as "N/A" with remarks: "No automated result generated"

---

## Recommendations

### Immediate Actions
1. **Communicate Coverage Gap to Auditors**
   - Display which items are automated vs. manual review
   - Show N/A items prominently with "Manual Review Required" notes

2. **Implement High-Priority Checks**
   - Company information detection (About, Contact, Organization details)
   - Content accessibility (headings, URLs, descriptions)
   - Resource sections (Downloads, Archives, FAQs)

3. **Add Manual Audit Workflow**
   - Allow auditors to manually enter Yes/No for N/A items
   - Save manual overrides to reports
   - Track which items were audited manually vs. automated

### Medium-Term
1. Add checks for:
   - Page structure detection (headings, semantic HTML)
   - Content signals (taglines, copyright, contact forms)
   - Navigation depth and breadcrumb structure
   - Mobile responsiveness verification

2. Integrate with:
   - Lighthouse for performance & UX metrics
   - Schema.org parser for structured data
   - Natural language models for content analysis

### Long-Term  
1. ML-based detection for:
   - Company information relevance & completeness
   - Content freshness and update frequency
   - User experience signals
   - Accessibility compliance beyond Axe-core

---

## Current Status
- ✅ Assessment forms displaying correctly (107 items)
- ✅ Stage/category visibility in reports  
- ⚠️ Only 16% of items have automated checks
- ⚠️ 84% of items will show "N/A" status
- 🔴 **Gap**: Form structure != Audit coverage

This is working as designed for the ~17 checks, but auditors need to understand that N/A items require manual review or future automation.
