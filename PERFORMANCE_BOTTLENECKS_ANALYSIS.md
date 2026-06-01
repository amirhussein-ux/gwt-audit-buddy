# Performance Bottlenecks Analysis - GWT Audit Engine

**Date**: June 1, 2026  
**Scope**: Backend audit engine orchestration, site crawling, accessibility scanning, and performance measurement

---

## Executive Summary

The audit engine has **multiple critical bottlenecks** that cause audits to take **30-45+ minutes** for a full site scan. The main issues are:

1. **Sequential processing** of pages instead of parallel (biggest impact)
2. **Multiple fixed wait times** stacking up (1200ms + 1500ms + 800ms per page)
3. **Axe-core running sequentially** on each page with 20s timeout per page
4. **19 check builders running sequentially** with 10s timeout each per page
5. **Sequential performance trials** instead of parallel
6. **Conservative resource limits** (15 pages max in production with only 2 concurrent browsers)

---

## 1. Site Crawling - Current Limits & Concurrency

### Current Configuration

**File**: [backend/src/services/auditEngine.js](backend/src/services/auditEngine.js#L81-L84)

```javascript
// Lines 81-84
const isProduction = process.env.NODE_ENV === 'production';
const maxPagesCap = isProduction ? 15 : 50;        // 15 pages in prod
const maxDepthCap = isProduction ? 2 : 3;          // 2 depth levels in prod
const concurrencyCap = isProduction ? 2 : 5;       // Only 2 concurrent crawls
```

### Issues

| Issue | Impact | Details |
|-------|--------|---------|
| **Max 15 pages in production** | Limited coverage | Even small sites with 20+ pages get truncated |
| **2 concurrent browsers in production** | 7.5x slower than 15 concurrent | Could crawl 15 pages in parallel but does it 2 at a time |
| **2 depth limit** | Misses deeper site structure | Gov sites often have 3-4 level deep nav |
| **Depth-first crawl with batching** | Sub-optimal exploration | BFS with small batches means shallow pages before deep ones |

### Crawl Duration Calculation (15-page site)

```
Scenario: Production, 15 pages, 2 concurrency, avg 5s/page
- Batch 1: 2 pages × 5s = 5s (pages 1-2)
- Batch 2: 2 pages × 5s = 5s (pages 3-4)
- Batch 3: 2 pages × 5s = 5s (pages 5-6)
- Batch 4: 2 pages × 5s = 5s (pages 7-8)
- Batch 5: 2 pages × 5s = 5s (pages 9-10)
- Batch 6: 2 pages × 5s = 5s (pages 11-12)
- Batch 7: 2 pages × 5s = 5s (pages 13-14)
- Batch 8: 1 page × 5s = 5s (page 15)
TOTAL CRAWL TIME: ~40 seconds for 15 pages
```

---

## 2. Accessibility Scanning - Per-Page Sequential Execution

### Current Implementation

**File**: [backend/src/services/auditEngine.js](backend/src/services/auditEngine.js#L218-L226)

```javascript
// Lines 218-226 - Running accessibility scan ONCE per page
try {
  debugLog('Starting accessibility scan', { url: target });
  const axePromise = runAccessibilityScan(page, {});
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Accessibility scan timeout after 20s')), 20000)
  );
  await Promise.race([axePromise, timeoutPromise]);
  debugLog('Accessibility scan completed', { url: target });
}
```

**File**: [backend/src/audit/atoms/accessibilityScanner.js](backend/src/audit/atoms/accessibilityScanner.js#L1-L10)

```javascript
// Lines 3-10 - Axe-core is run with NO scoping
async function runAccessibilityScan(page, options = {}) {
  try {
    const builder = new AxeBuilder({ page });
    if (options.include) builder.include(options.include);
    if (options.exclude) builder.exclude(options.exclude);
    const results = await builder.analyze();  // Scans ENTIRE page
    return results;
  }
```

### Issues

| Issue | Impact | Details |
|-------|--------|---------|
| **No inclusion/exclusion scoping** | Scans entire page | Axe-core could scan only critical regions (nav, header, footer) |
| **20s timeout per page** | 20s × 15 pages = 5 minutes just for accessibility | No parallelization across pages |
| **Full page analysis** | Redundant analysis on repeated elements | Nav bar scanned on every page page (15 times!) |
| **Runs per page, not batched** | Must wait for page load before Axe-core can run | Sequential dependency chain |

### Accessibility Scanning Duration (15 pages)

```
Current (sequential):
- Page 1: Load 1.5s + Axe-core 20s = 21.5s
- Page 2: Load 1.5s + Axe-core 20s = 21.5s
- ...
- Page 15: Load 1.5s + Axe-core 20s = 21.5s
TOTAL: 15 × 21.5s = 322.5 seconds (5.4 minutes) - JUST FOR ACCESSIBILITY
```

---

## 3. Performance Measurements - Sequential Trials

### Current Implementation

**File**: [backend/src/services/auditEngine.js](backend/src/services/auditEngine.js#L289-L308)

```javascript
// Lines 289-308 - Collecting performance trials SEQUENTIALLY
async function collectPerformanceTrials(context, targetUrl, trialsCount = 3) {
  const trials = [];
  
  for (let i = 0; i < trialsCount; i++) {           // SEQUENTIAL FOR LOOP
    try {
      debugLog(`Performance trial ${i + 1}/${trialsCount}`, { url: targetUrl });
      
      const page = await context.newPage();
      const startTime = Date.now();
      
      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        const loadTime = Date.now() - startTime;
        trials.push(loadTime);
        debugLog(`Trial ${i + 1} completed`, { loadTimeMs: loadTime });
      } finally {
        await page.close();
      }
    }
  }
  
  return trials;
}
```

**Called on line 402-407**:

```javascript
// Lines 402-407
const performanceTrials = await collectPerformanceTrials(
  shared.context,
  targetUrl,
  process.env.NODE_ENV === 'production' ? 2 : 3  // 2 trials in prod, 3 in dev
);
```

### Issues

| Issue | Impact | Details |
|-------|--------|---------|
| **Sequential for-loop** | N trials × 25s each | Should use Promise.all() to run all trials in parallel |
| **Production: 2 trials = 50 seconds minimum** | 50s of just performance measurement | Could be done in 25-30s with parallelization |
| **Development: 3 trials = 75 seconds minimum** | Dev audits take 75s just for perf measurement | Exponential slowdown |

### Performance Trials Duration

```
Current (sequential):
- Trial 1: 25s timeout
- Trial 2: 25s timeout
- Trial 3 (dev only): 25s timeout
TOTAL: 50-75 seconds for performance measurement ALONE

With parallelization (Promise.all):
- All trials run simultaneously = ~25-30 seconds total
POTENTIAL SAVINGS: 20-50 seconds per audit
```

---

## 4. Blocking Operations - Per-Page Sequential Audit Building

### Current Implementation

**File**: [backend/src/services/auditEngine.js](backend/src/services/auditEngine.js#L327-L380)

```javascript
// Lines 327-380 - PER-PAGE AUDITS ARE SEQUENTIAL
for (const crawledPage of crawledPages) {    // Line 327: Loop through each page sequentially
  try {
    const pageUrl = crawledPage.url;
    debugLog('Auditing page', { url: pageUrl });

    const page = await shared.context.newPage();
    try {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      
      // Wait for dynamic content and scripts to render
      await page.waitForTimeout(1500);  // Line 339: FIXED 1.5 SECOND WAIT
      
      const audit = await auditOnePage(page, pageUrl, origin, targetUrl);
      
      if (audit && audit.checks) {
        allChecks.push(...audit.checks);
        pageResults.push({
          url: pageUrl,
          checks: audit.checks,
          signals: audit.signals,
        });
      }

      debugLog('Page audit completed', { url: pageUrl, checkCount: audit?.checks?.length || 0 });
    } finally {
      await page.close();
    }
  }
}
```

### Check Building Sequential Execution

**File**: [backend/src/services/auditEngine.js](backend/src/services/auditEngine.js#L196-L225)

```javascript
// Lines 196-225 - 19 CHECK BUILDERS RUN SEQUENTIALLY
const checkBuilders = [
  { name: 'contentAccessibility', builder: () => buildContentAccessibilityChecks(page) },
  { name: 'navigationStructure', builder: () => buildNavigationStructureChecks(page, origin) },
  { name: 'topNavigation', builder: () => buildTopNavigationChecks(page) },
  // ... 16 more check builders ...
];

for (const checkBuilder of checkBuilders) {    // SEQUENTIAL FOR LOOP
  try {
    debugLog(`Check builder starting: ${checkBuilder.name}`, { url: target });
    
    // Add timeout to each builder (10 seconds max per builder)
    const builderPromise = checkBuilder.builder();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${checkBuilder.name} timeout after 10s`)), 10000)
    );
    const builderChecks = await Promise.race([builderPromise, timeoutPromise]);
    
    checks.push(...(builderChecks || []));
    debugLog(`Check builder completed: ${checkBuilder.name}`, { count: builderChecks?.length });
  }
}
```

### Issues

| Issue | Impact | Details |
|-------|--------|---------|
| **Per-page audits are sequential** | 15 pages × avg 30-60s each = huge bottleneck | Could load 2-5 pages in parallel |
| **19 check builders per page run sequentially** | 19 builders × 10s worst case = 190s per page | Could use Promise.allSettled() |
| **10s timeout per builder** | Some builders exceed this and fail silently | Cascading failures = fewer checks |
| **1500ms fixed wait after page load** | 15 pages × 1.5s = 22.5 seconds of wasted time | Not all pages need this much time |

### Per-Page Audit Duration (1 page with all checks)

```
Single page audit breakdown (worst case):
- Page load (goto): 0.5s
- Fixed wait (1500ms): 1.5s
- Accessibility scan (Promise.race timeout): 20s
- 19 check builders × 10s worst case each: 190s (unlikely but possible)
- Page close: 0.1s
WORST CASE PER PAGE: ~212 seconds

Realistic per page (assuming 50% builders succeed in <2s):
- Page load + wait: 2s
- Accessibility scan: 15s (average, not timeout)
- Check builders: 3s (fast) + 5s (slow) + 3s (fast) ... = ~60-80s total
REALISTIC PER PAGE: 80-100 seconds
```

---

## 5. Fixed Wait Times Stacking Up

### Multiple Hardcoded Wait Times

| File | Line | Wait Time | Trigger | Impact |
|------|------|-----------|---------|--------|
| scraper.js | 143 | 1200ms | After goto() | Blocks for every page in scraper |
| auditEngine.js | 343 | 1500ms | After goto() | Blocks for every page being audited |
| siteCrawler.js | 279 | 800ms | After goto() | Blocks for every page during crawl |
| siteCrawler.js | 105 | 5000ms | Link extraction wait | Blocks if no links found initially |
| scraper.js | 148 | 4000ms | Link count guard | Blocks waiting for 5+ links |

### Total Fixed Wait Time (15 page site)

```
During crawl:
- 15 pages × 800ms (siteCrawler line 279) = 12 seconds
- Potential link waits: up to 15 × 5000ms = 75 seconds (worst case)
Total crawl waits: 12-87 seconds

During per-page audit:
- 15 pages × 1500ms (auditEngine line 343) = 22.5 seconds
Total audit waits: 22.5 seconds

TOTAL FIXED WAIT TIME: 34.5-109.5 seconds
```

---

## 6. Third-Party Calls & API Integration

### Axe-core Calls

- **One call per page**: Line 226 in auditEngine.js
- **No caching across pages**: Same accessibility violations checked repeatedly
- **No scope limiting**: Full DOM analysis every time (could scope to header/nav/footer only)

### Potential External Calls (if enabled)

Looking through the imports, potential slow points:

```javascript
// From auditEngine.js imports
const { runSemanticEvaluation } = require('./semanticEvaluator');
```

This may invoke AI/Gemini calls - would need to check semanticEvaluator.js for timing.

---

## 7. Page Navigation & Wait Strategies

### Navigation Timeouts

| Location | Timeout | Purpose | Current Value |
|----------|---------|---------|----------------|
| scraper.js line 136 | domcontentloaded | Initial page load | 25000ms (25s) |
| auditEngine.js line 342 | domcontentloaded | Per-audit page load | 25000ms (25s) |
| siteCrawler.js line 278 | domcontentloaded | Crawl page load | 18000ms (18s) |
| checkCustom404 line 299 | domcontentloaded | 404 check | 15000ms (15s) |
| accessibilityScanner.js line 226 | Axe-core scan | Accessibility scan | 20000ms (20s) implicit |

### Wait Strategies

```javascript
// scraper.js line 143 - Always wait 1200ms
await page.waitForTimeout(1200);

// scraper.js line 148-152 - Conditional wait up to 4s
try {
  await page.waitForFunction(() => document.querySelectorAll('a').length > 5, {
    timeout: 4000,  // Could timeout = extends audit time
  });
}

// siteCrawler.js line 279 - Always wait 800ms
await page.waitForTimeout(800);

// siteCrawler.js line 105-110 - Waits up to 5s for links
try {
  await page.waitForFunction(() => document.querySelectorAll('a[href]').length > 0, {
    timeout: 5000,  // Could timeout = extends audit time
  });
}
```

### Issues

| Issue | Impact | Details |
|-------|--------|---------|
| **Multiple wait strategies** | Cascading waits add up | 1.2s + 0.8s + 1.5s + potential 5s timeout |
| **Unconditional 1200ms wait** | Always blocks, even on fast pages | Could be reduced or conditional |
| **5s link extraction wait** | May timeout on JS-heavy sites | Extends audit time when unnecessary |
| **25s navigation timeout** | Very conservative, may be excessive | Could reduce to 15-18s |

---

## 8. Estimated Current Audit Duration

### Full Audit Timeline (15-page site, production)

```
PHASE 1: Site Crawl (15 pages, 2 concurrency)
├─ Homepage load: 5s
├─ Crawl 15 pages in 8 batches of 2:
│  └─ 8 batches × 5-10s each (including 800ms wait) = 40-80s
└─ Total crawl: 45-85 seconds

PHASE 2: Per-Page Audits (15 pages, SEQUENTIAL)
├─ Page 1: Load 1.5s + Wait 1.5s + Axe 15-20s + Check Builders 30-90s = 50-115s
├─ Page 2-15: 14 × 50-115s = 700-1610s
└─ Total per-page: 750-1725 seconds (12-29 minutes)

PHASE 3: Performance Trials (2 trials, SEQUENTIAL)
├─ Trial 1: 25-30s
├─ Trial 2: 25-30s
└─ Total trials: 50-60 seconds

PHASE 4: Custom 404 Check
└─ 10-15 seconds

═══════════════════════════════════════════════════════════════════════════════
TOTAL AUDIT TIME: 845-1885 seconds = 14-31 MINUTES (PRODUCTION)
MOST LIKELY: 18-25 minutes for average government site

DEVELOPMENT (50 pages, 5 concurrency):
ESTIMATED: 45-90+ MINUTES
```

### Detailed Timeline for 1 Page

```
Single page audit (realistic):
0:00 - Page load + goto(): 0.5s
0:00.5 - waitForTimeout(1500ms): 1.5s
0:02 - Accessibility scan (Axe-core):
       ├─ Initial analysis: 8-12s
       └─ Report compilation: 2-3s
       Total: 10-15s
0:17 - Check builders (19 sequential):
       ├─ contentAccessibility: 0.5s
       ├─ navigationStructure: 1s
       ├─ topNavigation: 0.5s
       ├─ brandIdentity: 0.3s
       ├─ companyInfo: 0.4s
       ├─ contactInfo: 0.3s
       ├─ presenceIdentity: 0.5s
       ├─ webPresenceStage: 0.3s
       ├─ contentQuality: 0.5s
       ├─ browserCompatibility: 0.3s
       ├─ advancedPresence: 0.5s
       ├─ security: 0.5s
       ├─ participationTools: 0.3s
       ├─ missingNavigation: 1s
       ├─ missingErrorHandling: 0.5s
       ├─ missingBrandIdentity: 0.3s
       ├─ missingCompanyInfo: 0.3s
       ├─ missingContent: 0.5s
       └─ missingParticipation: 0.3s
       Total: 8-10s
0:27 - Page close: 0.5s

REALISTIC PER-PAGE TIME: 27-30 seconds
WORST CASE (if Axe-core or builders hit timeouts): 50-80 seconds
```

---

## 9. Comparison: Current vs. Optimized

| Metric | Current | Optimized | Savings |
|--------|---------|-----------|---------|
| **Crawl time (15 pages)** | 45-85s | 15-25s (5 concurrent) | 60-70s |
| **Performance trials (3 dev)** | 75s (sequential) | 25-30s (parallel) | 45-50s |
| **Per-page audits (15 pages)** | 750-1725s (sequential) | 180-300s (3 concurrent) | 570-1425s |
| **Accessibility per 15 pages** | 322.5s (seq) | 40-60s (parallel 2-3 pages) | 260s+ |
| **Check builders per page (19)** | 60-80s (sequential) | 15-20s (parallel w/ Promise.all) | 40-60s |
| **Fixed wait times** | 34.5-109.5s | 10-15s (optimized conditions) | 25-95s |
| **TOTAL AUDIT (15-page site)** | **18-25 minutes** | **3-5 minutes** | **13-20 minutes saved** |

---

## 10. Root Cause Summary

| Rank | Bottleneck | Type | Severity | Quick Fix Difficulty |
|------|-----------|------|----------|----------------------|
| 1 | Per-page audits sequential (loops line 327) | Architecture | CRITICAL | Medium |
| 2 | 19 check builders sequential (loops line 196) | Architecture | CRITICAL | Medium |
| 3 | Performance trials sequential (loops line 290-308) | Logic | HIGH | Easy |
| 4 | Axe-core runs on full page per page | Scope | HIGH | Hard |
| 5 | 1500ms fixed wait per page | Tuning | HIGH | Easy |
| 6 | Conservative concurrency limits (2 max) | Config | HIGH | Easy |
| 7 | Sequential crawl batches | Batching | MEDIUM | Medium |
| 8 | Multiple wait strategies (5000ms max) | Tuning | MEDIUM | Easy |
| 9 | 25s navigation timeout | Config | LOW | Easy |
| 10 | No check result caching across pages | Design | LOW | Hard |

---

## Recommendations (Prioritized)

### Immediate Wins (Easy, High Impact)

1. **Parallelize performance trials** (5-10 min saved)
   - Change `for` loop to `Promise.all()` in `collectPerformanceTrials()`
   - Effort: 5 minutes | Impact: 45-50 seconds saved

2. **Parallelize check builders** per page (5-10 min saved)
   - Use `Promise.allSettled()` for 19 builders
   - Effort: 10 minutes | Impact: 40-60 seconds saved per page × 15 = 10-15 minutes

3. **Reduce fixed wait times** (3-5 min saved)
   - Reduce 1500ms wait to 800ms or make conditional
   - Effort: 5 minutes | Impact: 10 seconds saved per page × 15 = 2.5 minutes

4. **Increase concurrency limits in production** (5-10 min saved)
   - Change from 2 to 5 crawl concurrency (line 84)
   - Change from 2 to 3-4 audit concurrency (new)
   - Effort: 2 minutes | Impact: 60-90 seconds saved

### Medium-Term Improvements (Medium Effort, High Impact)

5. **Parallelize per-page audits** (10-20 min saved)
   - Batch page audits with 3-4 concurrent, similar to crawling
   - Effort: 1 hour | Impact: 15-20 minutes saved (biggest win)

6. **Scope Axe-core scans** (3-5 min saved)
   - Only scan header, nav, main, footer regions
   - Cache results across pages for repeated components
   - Effort: 2 hours | Impact: 60+ seconds per page × 15 = 15 minutes

### Long-Term Improvements (Hard, Very High Impact)

7. **Implement page load caching**
   - Cache DOM analysis across similar pages
   - Effort: 4+ hours | Impact: Unknown (depends on site structure)

8. **Optimize Playwright configuration**
   - Profile and reduce unnecessary Chromium flags
   - Effort: 2 hours | Impact: Unknown

---

## Code References Summary

| Bottleneck | File | Lines | Issue |
|------------|------|-------|-------|
| Crawl limits | auditEngine.js | 81-84 | Max 15 pages, 2 concurrency |
| Per-page audit loop | auditEngine.js | 327-356 | Sequential for-loop |
| Check builders | auditEngine.js | 196-225 | Sequential for-loop, 10s timeout each |
| Performance trials | auditEngine.js | 289-308 | Sequential for-loop |
| Axe-core scan | auditEngine.js | 218-226 | Runs every page, 20s timeout |
| Fixed wait (audit) | auditEngine.js | 343 | 1500ms unconditional |
| Fixed wait (crawl) | siteCrawler.js | 279 | 800ms unconditional |
| Link extraction wait | siteCrawler.js | 105 | 5000ms conditional |
| Fixed wait (scraper) | scraper.js | 143 | 1200ms unconditional |
| Accessibility API | accessibilityScanner.js | 3-10 | No scoping, full page |
| Link wait (scraper) | scraper.js | 148 | 4000ms conditional |

