const fs = require('node:fs/promises');
const path = require('node:path');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'templates', 'Web Accessibility Audit Summary Report.xlsx');

const DEFAULT_MAPPING = [
  { rowNo: '1', templateRow: '7', key: 'performance.avg_load_time', category: 'Performance', guideline: 'Average page load time across 3 trials is 10 seconds or less', assessmentForm: 'Web Accessibility Assessment Form - Web Usability', assessmentSection: 'Performance' },
  { rowNo: '2', templateRow: '8', key: 'a11y.image_alt', category: 'Technical Accessibility', guideline: 'Image alternative text checks (H.1, H.2, H.3)', assessmentForm: 'Web Accessibility Assessment Form - Web Usability', assessmentSection: 'Accessibility' },
  { rowNo: '3', templateRow: '9', key: 'a11y.color_contrast', category: 'Technical Accessibility', guideline: 'Color contrast checks (C.1, C.2)', assessmentForm: 'Web Accessibility Assessment Form - Web Usability', assessmentSection: 'Accessibility' },
  { rowNo: '4', templateRow: '10', key: 'a11y.form_labels', category: 'Technical Accessibility', guideline: 'Form inputs have associated labels (H.6)', assessmentForm: 'Web Accessibility Assessment Form - Web Usability', assessmentSection: 'Accessibility' },
  { rowNo: '5', templateRow: '11', key: 'a11y.descriptive_links', category: 'Technical Accessibility', guideline: 'Avoid non-descriptive links like "Click Here" (B.10)', assessmentForm: 'Web Accessibility Assessment Form - Web Usability', assessmentSection: 'Content' },
  { rowNo: '6', templateRow: '12', key: 'presence.pst', category: 'Presence & Identity', guideline: 'PST element present in masthead', assessmentForm: 'Web Accessibility Assessment Form - Web Presence', assessmentSection: 'Presence and Identity' },
  { rowNo: '7', templateRow: '13', key: 'presence.logo_home', category: 'Presence & Identity', guideline: 'Logo is in masthead and links to homepage', assessmentForm: 'Web Accessibility Assessment Form - Web Presence', assessmentSection: 'Presence and Identity' },
  { rowNo: '8', templateRow: '14', key: 'presence.transparency_seal_link', category: 'Presence & Identity', guideline: 'Transparency Seal image exists and has a link', assessmentForm: 'Web Accessibility Assessment Form - Web Presence', assessmentSection: 'Presence and Identity' },
  { rowNo: '9', templateRow: '15', key: 'presence.breadcrumbs', category: 'Presence & Identity', guideline: 'Breadcrumb navigation is enabled', assessmentForm: 'Web Accessibility Assessment Form - Web Presence', assessmentSection: 'Navigation' },
  { rowNo: '10', templateRow: '16', key: 'presence.govph_link', category: 'Presence & Identity', guideline: 'GovPH link exists in top menu', assessmentForm: 'Web Accessibility Assessment Form - Web Presence', assessmentSection: 'Presence and Identity' },
  { rowNo: '11', templateRow: '17', key: 'navigation.about_link', category: 'Navigation', guideline: 'About Us link is easy to find at top', assessmentForm: 'Web Accessibility Assessment Form - Web Presence', assessmentSection: 'Navigation' },
  { rowNo: '12', templateRow: '18', key: 'navigation.contact_link', category: 'Navigation', guideline: 'Contact link is easy to find at top', assessmentForm: 'Web Accessibility Assessment Form - Web Presence', assessmentSection: 'Navigation' },
  { rowNo: '13', templateRow: '19', key: 'error.custom_404', category: 'Error Handling', guideline: 'Custom 404 page is returned for invalid path', assessmentForm: 'Web Accessibility Assessment Form - Web Presence', assessmentSection: 'Error Handling' },
  { rowNo: '14', templateRow: '20', key: 'semantic.tagline_clear', category: 'Semantic Content', guideline: 'Tagline clearly states institution purpose', assessmentForm: 'Web Accessibility Assessment Form - Web Presence', assessmentSection: 'Content and Semantics' },
  { rowNo: '15', templateRow: '21', key: 'semantic.whitespace_layout', category: 'Semantic Content', guideline: 'Homepage is uncluttered with sufficient white space', assessmentForm: 'Web Accessibility Assessment Form - Web Presence', assessmentSection: 'Content and Semantics' },
  { rowNo: '16', templateRow: '22', key: 'semantic.about_contact_top', category: 'Semantic Content', guideline: 'About Us and Contact Us are easy to find at top', assessmentForm: 'Web Accessibility Assessment Form - Web Presence', assessmentSection: 'Navigation' },
];

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

async function loadAssessmentMapping() {
  const mappingPath = path.join(__dirname, '..', 'config', 'Assessment Guidelines.csv');

  try {
    await fs.access(mappingPath);
  } catch {
    return DEFAULT_MAPPING;
  }

  const raw = await fs.readFile(mappingPath, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return DEFAULT_MAPPING;
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const records = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    return {
      rowNo: record.rowno || record.row_no || record.row || '',
      templateRow: record.templaterow || record.template_row || '',
      key: record.key || record.id || '',
      category: record.category || 'General',
      guideline: record.guideline || record.item || record.description || '',
      assessmentForm: record.assessmentform || record.form || '',
      assessmentStage: record.assessmentstage || record.stage || '',
      assessmentSection: record.assessmentsection || record.section || '',
    };
  });

  const valid = records.filter((record) => record.key && record.guideline);
  return valid.length > 0 ? valid : DEFAULT_MAPPING;
}

function buildWorksheet(workbook) {
  const sheet = workbook.addWorksheet('Audit Summary');
  sheet.columns = [
    { header: 'No.', key: 'rowNo', width: 10 },
    { header: 'Assessment Guideline', key: 'guideline', width: 50 },
    { header: 'Stage/Category', key: 'stageOrCategory', width: 35 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Remarks', key: 'remarks', width: 65 },
  ];
  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = 'Web Accessibility Audit Summary Report';
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A3').value = 'Target URL';
  sheet.getCell('A4').value = 'Audit Date';
  sheet.getRow(6).values = ['No.', 'Assessment Guideline', 'Stage/Category', 'Category', 'Status', 'Remarks'];
  sheet.getRow(6).font = { bold: true };
  return sheet;
}

async function loadOrCreateTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  try {
    await fs.access(TEMPLATE_PATH);
    await workbook.xlsx.readFile(TEMPLATE_PATH);
    return workbook;
  } catch {
    buildWorksheet(workbook);
    return workbook;
  }
}

function statusFill(status) {
  // Accept either numeric point values or status strings and map to
  // the four-tier color legend for Excel export (Audit Summary -> Status)
  // 1 - With Web Presence: Green (#28a745)
  // 2 - Under Development: Orange (#fd7e14)
  // 3 - Offline/Not Accessible: Light Red (#f8d7da)
  // 0 - Without Web Presence: Dark Red (#dc3545)
  // Also keep backward compatibility for 'Pass'/'Fail'/'N/A'.

  const mapping = {
    '1': 'FF28A745',
    1: 'FF28A745',
    'With Web Presence': 'FF28A745',
    'Pass': 'FF28A745',

    '2': 'FFFD7E14',
    2: 'FFFD7E14',
    'Under Development': 'FFFD7E14',

    '3': 'FFF8D7DA',
    3: 'FFF8D7DA',
    'Offline/Not Accessible': 'FFF8D7DA',

    '0': 'FFDC3545',
    0: 'FFDC3545',
    'Without Web Presence': 'FFDC3545',

    'Fail': 'FFDC3545',
    'N/A': 'FFE2E3E5',
  };

  const argb = mapping[status] || mapping[String(status)] || 'FFFFC7CE';
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
  };
}

function buildDetailsSheet(workbook, pageAudits = []) {
  const existing = workbook.getWorksheet('Audit Details');
  if (existing) {
    workbook.removeWorksheet(existing.id);
  }

  const sheet = workbook.addWorksheet('Audit Details');
  sheet.columns = [
    { header: 'URL', key: 'url', width: 60 },
    { header: 'Depth', key: 'depth', width: 10 },
    { header: 'Page Status', key: 'pageStatus', width: 14 },
    { header: 'Load Time (ms)', key: 'loadTimeMs', width: 14 },
    { header: 'PST', key: 'pst', width: 10 },
    { header: 'Logo->Home', key: 'logoHome', width: 12 },
    { header: 'Breadcrumbs', key: 'breadcrumbs', width: 12 },
    { header: 'Menu Signature', key: 'menuSignature', width: 30 },
    { header: 'Violations', key: 'violations', width: 60 },
    { header: 'Remarks', key: 'remarks', width: 70 },
  ];

  for (const page of pageAudits) {
    sheet.addRow({
      url: page.url,
      depth: page.depth,
      pageStatus: page.error ? 'Fail' : 'Pass',
      loadTimeMs: Number.isFinite(page.loadTimeMs) ? page.loadTimeMs : null,
      pst: page.pstFound ? 'Pass' : 'Fail',
      logoHome: page.logoLinksHome ? 'Pass' : 'Fail',
      breadcrumbs: page.breadcrumbEnabled ? 'Pass' : 'Fail',
      menuSignature: page.menuSignature || 'n/a',
      violations: (page.violationsSummary || []).join(' | ') || 'No recorded violations',
      remarks: page.error || '',
    });
  }

  sheet.getRow(1).font = { bold: true };
  sheet.getColumn('I').alignment = { wrapText: true, vertical: 'top' };
  sheet.getColumn('J').alignment = { wrapText: true, vertical: 'top' };
  sheet.eachRow((row) => {
    row.alignment = { vertical: 'middle' };
  });
}

function scoreFromStatus(status) {
  if (status === 'Pass') return 1;
  if (status === 'N/A') return 0.5;
  return 0;
}

function percentFromChecks(checks) {
  if (!checks || checks.length === 0) {
    return 0;
  }

  const total = checks.reduce((sum, check) => sum + scoreFromStatus(check.status), 0);
  return Math.round((total / checks.length) * 100);
}

// Map a percentage (0-100) to the transmuted point values for Web Presence
// 1 (Pass): 90-100
// 2 (Mostly Passed): 75-89
// 3 (Barely Passed): 50-74
// 0 (Fail): Below 50
function percentToPoint(percent) {
  if (percent >= 90) return 1;
  if (percent >= 75) return 2;
  if (percent >= 50) return 3;
  return 0;
}
function checksByKeys(checkIndex, keys) {
  return keys
    .map((key) => checkIndex.get(key))
    .filter(Boolean);
}

function inferAssessmentForm(checkKey, category) {
  if (checkKey.startsWith('a11y.') || checkKey.startsWith('performance.')) {
    return 'Web Accessibility Assessment Form - Web Usability';
  }

  if (checkKey.startsWith('presence.') || checkKey.startsWith('navigation.') || checkKey.startsWith('error.') || checkKey.startsWith('semantic.')) {
    return 'Web Accessibility Assessment Form - Web Presence';
  }

  if ((category || '').toLowerCase().includes('accessibility')) {
    return 'Web Accessibility Assessment Form - Web Usability';
  }

  return 'Web Accessibility Assessment Form - Web Presence';
}

function inferAutomationMethod(checkKey) {
  if (checkKey.startsWith('a11y.')) {
    return 'Axe-core accessibility scan and DOM assertions';
  }

  if (checkKey.startsWith('performance.')) {
    return 'Three navigation timing trials';
  }

  if (checkKey.startsWith('semantic.')) {
    return 'Semantic content evaluator with page snapshot';
  }

  if (checkKey.startsWith('error.')) {
    return 'Custom invalid-route probe (/404)';
  }

  return 'Crawler-based DOM signal evaluation';
}

function buildTraceabilityRows(mapping, checkIndex) {
  return mapping.map((mapRow) => {
    const check = checkIndex.get(mapRow.key);
    const status = check?.status || 'N/A';
    return {
      rowNo: mapRow.rowNo || '',
      key: mapRow.key,
      guideline: mapRow.guideline,
      category: mapRow.category,
      assessmentForm: mapRow.assessmentForm || inferAssessmentForm(mapRow.key, mapRow.category),
      assessmentStage: mapRow.assessmentStage || '',
      assessmentSection: mapRow.assessmentSection || mapRow.category,
      automationMethod: inferAutomationMethod(mapRow.key),
      status,
      evidence: check?.remarks || 'No automated result generated for this assessment guideline.',
    };
  });
}

function buildOrderedCategories(mapping, checkIndex) {
  const grouped = new Map();

  for (const mapRow of mapping) {
    const check = checkIndex.get(mapRow.key);
    const section = mapRow.assessmentSection || mapRow.category || 'General';
    if (!grouped.has(section)) {
      grouped.set(section, []);
    }

    grouped.get(section).push({
      id: mapRow.key,
      criterion: mapRow.guideline,
      status: check?.status || 'N/A',
      remark: check?.remarks || 'No automated result generated for this assessment guideline.',
    });
  }

  return Array.from(grouped.entries()).map(([name, items]) => ({ name, items }));
}

async function buildUiAuditSummary(auditResults) {
  const mapping = await loadAssessmentMapping();
  const checkIndex = new Map((auditResults.checks || []).map((check) => [check.key, check]));
  const checks = auditResults.checks || [];

  // Group mapping rows by form and stage for dynamic scoring
  const mappingByFormAndStage = new Map();
  for (const mapRow of mapping) {
    const form = mapRow.assessmentForm || '';
    const stage = mapRow.assessmentStage || '';
    const key = `${form}::${stage}`;
    
    if (!mappingByFormAndStage.has(key)) {
      mappingByFormAndStage.set(key, []);
    }
    mappingByFormAndStage.get(key).push(mapRow);
  }

  // Calculate Web Presence scores (Stage 1-4)
  const stage1Keys = mapping
    .filter(m => m.assessmentForm?.includes('Web Presence') && m.assessmentStage?.includes('Stage 1'))
    .map(m => m.key);
  
  const stage2Keys = mapping
    .filter(m => m.assessmentForm?.includes('Web Presence') && m.assessmentStage?.includes('Stage 2'))
    .map(m => m.key);
  
  const stage3Keys = mapping
    .filter(m => m.assessmentForm?.includes('Web Presence') && m.assessmentStage?.includes('Stage 3'))
    .map(m => m.key);
  
  const stage4Keys = mapping
    .filter(m => m.assessmentForm?.includes('Web Presence') && m.assessmentStage?.includes('Stage 4'))
    .map(m => m.key);

  const stage1 = percentFromChecks(checksByKeys(checkIndex, stage1Keys));
  const stage2 = percentFromChecks(checksByKeys(checkIndex, stage2Keys));
  const stage3 = percentFromChecks(checksByKeys(checkIndex, stage3Keys));
  const stage4 = percentFromChecks(checksByKeys(checkIndex, stage4Keys));

  const webPresenceTotal = stage1Keys.length > 0 || stage2Keys.length > 0 || stage3Keys.length > 0 || stage4Keys.length > 0
    ? Math.round(([stage1, stage2, stage3, stage4].reduce((a, b) => a + b, 0) / 4))
    : 0;

  // Calculate Web Usability scores by category (Accessibility, Identity, Navigation, Content)
  const accessibilityKeys = mapping
    .filter(m => m.assessmentForm?.includes('Web Usability') && m.assessmentStage?.includes('Usability - Accessibility'))
    .map(m => m.key);
  
  const identityKeys = mapping
    .filter(m => m.assessmentForm?.includes('Web Usability') && m.assessmentStage?.includes('Usability - Identity'))
    .map(m => m.key);
  
  const navigationKeys = mapping
    .filter(m => m.assessmentForm?.includes('Web Usability') && m.assessmentStage?.includes('Usability - Navigation'))
    .map(m => m.key);
  
  const contentKeys = mapping
    .filter(m => m.assessmentForm?.includes('Web Usability') && m.assessmentStage?.includes('Usability - Content'))
    .map(m => m.key);

  const accessibility = percentFromChecks(checksByKeys(checkIndex, accessibilityKeys));
  const identity = percentFromChecks(checksByKeys(checkIndex, identityKeys));
  const navigation = percentFromChecks(checksByKeys(checkIndex, navigationKeys));
  const content = percentFromChecks(checksByKeys(checkIndex, contentKeys));

  const webUsabilityTotal = accessibilityKeys.length > 0 || identityKeys.length > 0 || navigationKeys.length > 0 || contentKeys.length > 0
    ? Math.round(([accessibility, identity, navigation, content].reduce((a, b) => a + b, 0) / 4))
    : 0;

  const categories = buildOrderedCategories(mapping, checkIndex);

  const traceability = buildTraceabilityRows(mapping, checkIndex);
  const evaluatedGuidelines = traceability.filter((item) => item.status !== 'N/A').length;
  const methodology = {
    mappedGuidelines: traceability.length,
    evaluatedGuidelines,
    coveragePercent: traceability.length > 0 ? Math.round((evaluatedGuidelines / traceability.length) * 100) : 0,
    pagesCrawled: auditResults?.crawlSummary?.pagesCrawled || 0,
    generatedAt: auditResults.auditedAt,
  };
  // Transmute percentage scores into the four-tier point system (for Web Presence only)
  const rawStagePercents = [stage1, stage2, stage3, stage4];
  const stagePoints = rawStagePercents.map((p) => percentToPoint(p));

  // Apply cascading dependency: if any preceding stage is NOT a 1 (Pass),
  // then all subsequent stages are restricted from being 1.
  for (let i = 0; i < stagePoints.length; i += 1) {
    if (stagePoints[i] !== 1) {
      for (let j = i + 1; j < stagePoints.length; j += 1) {
        if (stagePoints[j] === 1) {
          // Downgrade a disallowed '1' to '2' while preserving other values
          stagePoints[j] = 2;
        }
      }
      break; // once a preceding non-1 found, cascade applied for remaining
    }
  }

  const presenceLegend = {
    1: { label: 'With Web Presence', color: '#28a745' },
    2: { label: 'Under Development', color: '#fd7e14' },
    3: { label: 'Offline/Not Accessible', color: '#f8d7da' },
    0: { label: 'Without Web Presence', color: '#dc3545' },
  };

  const webPresenceUi = {
    // keep the raw percent values for display
    stage1: rawStagePercents[0],
    stage2: rawStagePercents[1],
    stage3: rawStagePercents[2],
    stage4: rawStagePercents[3],
    // transmuted point values (1,2,3,0) applied only to the Web Presence scoreboard
    stage1Point: stagePoints[0],
    stage2Point: stagePoints[1],
    stage3Point: stagePoints[2],
    stage4Point: stagePoints[3],
    // human-friendly labels and colors for the UI card
    legend: presenceLegend,
    total: webPresenceTotal,
  };

  return {
    url: auditResults.url,
    date: new Date(auditResults.auditedAt).toLocaleString(),
    webPresence: webPresenceUi,
    webUsability: {
      accessibility,
      identity,
      navigation,
      content,
      total: webUsabilityTotal,
    },
    categories,
    methodology,
    traceability,
  };
}

async function generateAuditReportPdf(auditResults) {
  const mapping = await loadAssessmentMapping();
  const checkIndex = new Map((auditResults.checks || []).map((check) => [check.key, check]));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('Web Accessibility Audit Summary Report', { align: 'center' });
    doc.moveDown(0.8);
    doc.fontSize(10).text(`Target URL: ${auditResults.url}`);
    doc.text(`Audit Date: ${auditResults.auditedAt}`);
    doc.text(`Pages Crawled: ${auditResults?.crawlSummary?.pagesCrawled ?? 0}`);
    doc.moveDown(0.8);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const col = {
      no: 30,
      stage: 80,
      guideline: 150,
      category: 80,
      status: 45,
      remarks: pageWidth - 30 - 80 - 150 - 80 - 45,
    };

    function ensureSpace(minY) {
      if (doc.y > minY) {
        doc.addPage();
      }
    }

    function drawHeader() {
      doc.fontSize(8).font('Helvetica-Bold');
      const x = doc.page.margins.left;
      const y = doc.y;
      doc.text('No.', x, y, { width: col.no });
      doc.text('Stage/Category', x + col.no, y, { width: col.stage });
      doc.text('Assessment Guideline', x + col.no + col.stage, y, { width: col.guideline });
      doc.text('Category', x + col.no + col.stage + col.guideline, y, { width: col.category });
      doc.text('Status', x + col.no + col.stage + col.guideline + col.category, y, { width: col.status });
      doc.text('Remarks', x + col.no + col.stage + col.guideline + col.category + col.status, y, { width: col.remarks });
      doc.moveDown(0.6);
      doc.font('Helvetica');
    }

    drawHeader();

    for (const mapRow of mapping) {
      const check = checkIndex.get(mapRow.key);
      const status = check ? check.status : 'N/A';
      const remarks = check ? check.remarks : 'No result was generated for this guideline.';
      const stageOrCategory = mapRow.assessmentStage || mapRow.category || '';
      ensureSpace(doc.page.height - 80);

      const x = doc.page.margins.left;
      const y = doc.y;
      const wrappedHeights = [
        doc.heightOfString(String(mapRow.rowNo || ''), { width: col.no }),
        doc.heightOfString(stageOrCategory, { width: col.stage }),
        doc.heightOfString(mapRow.guideline || '', { width: col.guideline }),
        doc.heightOfString(mapRow.category || '', { width: col.category }),
        doc.heightOfString(status, { width: col.status }),
        doc.heightOfString(remarks, { width: col.remarks }),
      ];
      const rowHeight = Math.max(...wrappedHeights) + 4;

      if (doc.y + rowHeight > doc.page.height - 50) {
        doc.addPage();
        drawHeader();
      }

      doc.fontSize(7.5);
      doc.text(String(mapRow.rowNo || ''), x, y, { width: col.no });
      doc.text(stageOrCategory, x + col.no, y, { width: col.stage });
      doc.text(mapRow.guideline || '', x + col.no + col.stage, y, { width: col.guideline });
      doc.text(mapRow.category || '', x + col.no + col.stage + col.guideline, y, { width: col.category });
      doc.text(status, x + col.no + col.stage + col.guideline + col.category, y, { width: col.status });
      doc.text(remarks, x + col.no + col.stage + col.guideline + col.category + col.status, y, { width: col.remarks });
      doc.y = y + rowHeight;
    }

    doc.end();
  });
}

async function generateAuditReport(auditResults) {
  const mapping = await loadAssessmentMapping();
  const checkIndex = new Map(auditResults.checks.map((check) => [check.key, check]));

  const workbook = await loadOrCreateTemplateWorkbook();
  workbook.creator = 'GWT Audit Buddy';
  workbook.created = new Date();

  const sheet = workbook.getWorksheet('Audit Summary') || workbook.getWorksheet(1) || buildWorksheet(workbook);
  sheet.getCell('A3').value = 'Target URL';
  sheet.getCell('B3').value = auditResults.url;
  sheet.getCell('A4').value = 'Audit Date';
  sheet.getCell('B4').value = auditResults.auditedAt;

  mapping.forEach((mapRow) => {
    const check = checkIndex.get(mapRow.key);
    const status = check ? check.status : 'N/A';
    const remarks = check ? check.remarks : 'No result was generated for this guideline.';
    const stageOrCategory = mapRow.assessmentStage || mapRow.category || '';
    const templateRow = Number.parseInt(mapRow.templateRow, 10);
    const targetRow = Number.isFinite(templateRow) && templateRow > 0 ? templateRow : 6 + Number(mapRow.rowNo || 0);

    sheet.getCell(`A${targetRow}`).value = mapRow.rowNo;
    sheet.getCell(`B${targetRow}`).value = mapRow.guideline;
    sheet.getCell(`C${targetRow}`).value = stageOrCategory;
    sheet.getCell(`D${targetRow}`).value = mapRow.category;
    sheet.getCell(`E${targetRow}`).value = status;
    sheet.getCell(`F${targetRow}`).value = remarks;
    sheet.getCell(`E${targetRow}`).fill = statusFill(status);
  });

  sheet.getColumn('F').alignment = { wrapText: true, vertical: 'top' };
  sheet.eachRow((row) => {
    row.alignment = { vertical: 'middle' };
  });

  buildDetailsSheet(workbook, auditResults.pageAudits || []);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = {
  generateAuditReport,
  generateAuditReportPdf,
  buildUiAuditSummary,
  loadAssessmentMapping,
};
