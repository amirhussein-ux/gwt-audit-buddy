const { normalizeCheck } = require('../audit/molecules/gwtChecker');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function buildSemanticNaChecks(reason) {
  return [
    normalizeCheck({
      key: 'semantic.tagline_clear',
      category: 'Semantic Content',
      item: "Tagline makes the institution's purpose clear",
      status: 'N/A',
      remarks: reason,
    }),
    normalizeCheck({
      key: 'semantic.whitespace_layout',
      category: 'Semantic Content',
      item: 'Homepage layout is uncluttered and has sufficient white space',
      status: 'N/A',
      remarks: reason,
    }),
    normalizeCheck({
      key: 'semantic.about_contact_top',
      category: 'Semantic Content',
      item: 'About Us and Contact Us are easy to find at the top',
      status: 'N/A',
      remarks: reason,
    }),
  ];
}

function extractJson(text) {
  const cleaned = text.trim();
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    return cleaned;
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return cleaned.slice(start, end + 1);
  }

  return null;
}

function normalizeSemanticCheck(key, item, payload) {
  const status = ['Pass', 'Fail', 'N/A'].includes(payload?.status) ? payload.status : 'N/A';
  const remarks = typeof payload?.remarks === 'string' && payload.remarks.trim()
    ? payload.remarks.trim()
    : 'No semantic remarks were generated.';

  return normalizeCheck({
    key,
    category: 'Semantic Content',
    item,
    status,
    remarks,
  });
}

async function runSemanticEvaluation(page, auditedUrl) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildSemanticNaChecks('GEMINI_API_KEY is not configured. Semantic checks set to N/A.');
  }

  const snapshot = await page.evaluate(() => {
    const title = document.title || '';
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const h1 = Array.from(document.querySelectorAll('h1')).map((node) => node.textContent?.trim()).filter(Boolean);
    const mastheadLinks = Array.from(document.querySelectorAll('header a, nav a, [role="banner"] a'))
      .map((anchor) => (anchor.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 20);
    const visibleText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 4000);

    return {
      title,
      description,
      h1,
      mastheadLinks,
      visibleText,
      nodeCounts: {
        paragraphs: document.querySelectorAll('p').length,
        sections: document.querySelectorAll('section, article, main').length,
        images: document.querySelectorAll('img').length,
      },
    };
  });

  const prompt = [
    'Evaluate this government homepage summary based on three semantic checks.',
    'Respond ONLY with valid JSON in this exact shape:',
    '{',
    '  "tagline_clear": { "status": "Pass|Fail|N/A", "remarks": "..." },',
    '  "whitespace_layout": { "status": "Pass|Fail|N/A", "remarks": "..." },',
    '  "about_contact_top": { "status": "Pass|Fail|N/A", "remarks": "..." }',
    '}',
    'Use concise, evidence-based remarks tied to provided content.',
    `Audited URL: ${auditedUrl}`,
    `Snapshot JSON: ${JSON.stringify(snapshot)}`,
  ].join('\n');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      return buildSemanticNaChecks(`Gemini request failed with status ${response.status}.`);
    }

    const data = await response.json();
    const modelText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonPayload = extractJson(modelText);
    if (!jsonPayload) {
      return buildSemanticNaChecks('Gemini response did not contain valid JSON content.');
    }

    const parsed = JSON.parse(jsonPayload);
    return [
      normalizeSemanticCheck(
        'semantic.tagline_clear',
        "Tagline makes the institution's purpose clear",
        parsed.tagline_clear
      ),
      normalizeSemanticCheck(
        'semantic.whitespace_layout',
        'Homepage layout is uncluttered and has sufficient white space',
        parsed.whitespace_layout
      ),
      normalizeSemanticCheck(
        'semantic.about_contact_top',
        'About Us and Contact Us are easy to find at the top',
        parsed.about_contact_top
      ),
    ];
  } catch (error) {
    return buildSemanticNaChecks(`Gemini call error: ${error.message}`);
  }
}

module.exports = {
  runSemanticEvaluation,
};
