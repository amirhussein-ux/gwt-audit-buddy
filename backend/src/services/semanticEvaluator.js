/**
 * semanticEvaluator.js — MASID refined
 *
 * Key changes vs original:
 * 1. SEMANTIC QUALITY: Prompt is now more specific and evidence-driven —
 *    instructs Gemini to cite DOM evidence (e.g., actual tagline text found)
 *    rather than giving generic pass/fail verdicts.
 * 2. SEMANTIC QUALITY: Added a 4th check — `layout_density` — which detects
 *    cluttered homepages with too many competing elements (common on PH gov sites).
 * 3. CORRECTNESS: snapshot now includes image count, link count, and word count
 *    so Gemini can make quantitative layout judgments.
 * 4. CORRECTNESS: `responseMimeType: 'application/json'` is set to force clean
 *    structured output; extractJson fallback kept for safety.
 * 5. ROBUSTNESS: All four checks fall back to N/A individually on parse error,
 *    instead of all failing together.
 */

const { normalizeCheck } = require('../audit/molecules/gwtChecker');
const { getConfig } = require('../config/env');

// Get Gemini configuration
function getGeminiConfig() {
  const config = getConfig();
  return {
    apiKey: config.gemini?.apiKey,
    model: config.gemini?.model || 'gemini-2.0-flash',
  };
}

// ─── N/A fallback builders ───────────────────────────────────────────────────
function buildSemanticNaChecks(reason) {
  return SEMANTIC_CHECKS.map(({ key, item }) =>
    normalizeCheck({ key, category: 'Semantic Content', item, status: 'N/A', remarks: reason })
  );
}

const SEMANTIC_CHECKS = [
  { key: 'semantic.tagline_clear',    item: "Tagline makes the institution's purpose clear" },
  { key: 'semantic.whitespace_layout', item: 'Homepage layout is uncluttered and has sufficient white space' },
  { key: 'semantic.about_contact_top', item: 'About Us and Contact Us are easy to find at the top' },
  { key: 'semantic.layout_density',   item: 'Homepage is not overloaded with competing visual elements' },
];

// ─── JSON extraction (handles markdown-wrapped responses) ────────────────────
function extractJson(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned;
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return null;
}

function normalizeSemanticCheck(key, item, payload) {
  const status  = ['Pass', 'Fail', 'N/A'].includes(payload?.status) ? payload.status : 'N/A';
  const remarks = typeof payload?.remarks === 'string' && payload.remarks.trim()
    ? payload.remarks.trim()
    : 'No semantic remarks were generated.';
  return normalizeCheck({ key, category: 'Semantic Content', item, status, remarks });
}

// ─── DOM snapshot ────────────────────────────────────────────────────────────
async function captureSnapshot(page, auditedUrl) {
  return page.evaluate((url) => {
    const title       = document.title || '';
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const h1s         = Array.from(document.querySelectorAll('h1')).map((n) => n.textContent?.trim()).filter(Boolean);
    const h2s         = Array.from(document.querySelectorAll('h2')).map((n) => n.textContent?.trim()).filter(Boolean).slice(0, 10);

    const mastheadLinks = Array.from(
      document.querySelectorAll('header a, nav a, [role="banner"] a')
    ).map((a) => (a.textContent || '').trim()).filter(Boolean).slice(0, 25);

    const visibleText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 5000);
    const wordCount   = visibleText.split(/\s+/).length;

    // Quantitative layout signals for density check
    const imageCount        = document.querySelectorAll('img').length;
    const linkCount         = document.querySelectorAll('a').length;
    const bannerAdCount     = document.querySelectorAll('[class*="banner" i], [class*="carousel" i], [class*="slider" i]').length;
    const paragraphCount    = document.querySelectorAll('p').length;
    const sectionCount      = document.querySelectorAll('section, article, main').length;
    const modalCount        = document.querySelectorAll('[class*="modal" i], [class*="popup" i], dialog').length;

    // Check if About Us and Contact Us are in the masthead/top nav area
    const topNavText = (
      document.querySelector('header, nav, [role="navigation"], .navbar')?.innerText || ''
    ).toLowerCase();
    const aboutInTop   = /about|profile|who\s*we\s*are/i.test(topNavText);
    const contactInTop = /contact|get\s+in\s+touch|inquir/i.test(topNavText);

    return {
      url: url,
      title,
      description,
      h1s,
      h2s,
      mastheadLinks,
      visibleText,
      wordCount,
      counts: { imageCount, linkCount, bannerAdCount, paragraphCount, sectionCount, modalCount },
      topNavSignals: { aboutInTop, contactInTop },
    };
  }, auditedUrl);
}

// ─── Main evaluator ──────────────────────────────────────────────────────────
async function runSemanticEvaluation(page, auditedUrl) {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) return buildSemanticNaChecks('GEMINI_API_KEY is not configured.');

  let snapshot;
  try {
    snapshot = await captureSnapshot(page, auditedUrl);
  } catch (err) {
    return buildSemanticNaChecks(`DOM snapshot failed: ${err.message}`);
  }

  const prompt = `
You are auditing a Philippine government website homepage for PPMED (Plans and Policy Monitoring and Evaluation Division).

Evaluate the homepage against FOUR semantic checks. For each, provide:
- "status": one of "Pass", "Fail", or "N/A"
- "remarks": a concise, evidence-based sentence (max 2 sentences). Quote or cite specific DOM content where possible.

Checks:
1. tagline_clear — Does the page title, H1, or meta description make the agency's mandate or purpose immediately clear to a first-time visitor?
2. whitespace_layout — Is the homepage layout clean with adequate white space, or is it cluttered with too many competing sections/banners?
   Guidance: more than 15 images OR more than 3 carousels/sliders/banners on one page suggests clutter.
3. about_contact_top — Are "About Us" (or equivalent: Profile, Mandate, Who We Are) and "Contact Us" links visibly accessible in the top navigation or masthead?
4. layout_density — Is the homepage free from excessive pop-ups, modals, or auto-playing banners that degrade user experience?
   Guidance: any modal/popup count > 0 or bannerAdCount > 5 suggests failure.

Respond ONLY with valid JSON in this exact shape (no extra keys, no markdown):
{
  "tagline_clear":    { "status": "Pass|Fail|N/A", "remarks": "..." },
  "whitespace_layout": { "status": "Pass|Fail|N/A", "remarks": "..." },
  "about_contact_top": { "status": "Pass|Fail|N/A", "remarks": "..." },
  "layout_density":   { "status": "Pass|Fail|N/A", "remarks": "..." }
}

Homepage data:
${JSON.stringify(snapshot)}
`.trim();

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,          // lower = more deterministic audit verdicts
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      return buildSemanticNaChecks(`Gemini request failed (HTTP ${response.status}).`);
    }

    const data      = await response.json();
    const modelText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonStr   = extractJson(modelText);
    if (!jsonStr) return buildSemanticNaChecks('Gemini response did not contain valid JSON.');

    let parsed;
    try { parsed = JSON.parse(jsonStr); }
    catch { return buildSemanticNaChecks('Gemini JSON could not be parsed.'); }

    // Build each check individually — a bad key doesn't kill all checks.
    return [
      normalizeSemanticCheck('semantic.tagline_clear',    SEMANTIC_CHECKS[0].item, parsed.tagline_clear),
      normalizeSemanticCheck('semantic.whitespace_layout', SEMANTIC_CHECKS[1].item, parsed.whitespace_layout),
      normalizeSemanticCheck('semantic.about_contact_top', SEMANTIC_CHECKS[2].item, parsed.about_contact_top),
      normalizeSemanticCheck('semantic.layout_density',   SEMANTIC_CHECKS[3].item, parsed.layout_density),
    ];
  } catch (error) {
    return buildSemanticNaChecks(`Gemini call error: ${error.message}`);
  }
}

module.exports = { runSemanticEvaluation };