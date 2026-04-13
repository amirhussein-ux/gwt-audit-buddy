const ExcelJS = require('exceljs');
const path = require('path');

async function inspectExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  console.log(`\n=== Inspecting: ${path.basename(filePath)} ===`);
  console.log(`Sheet count: ${workbook.worksheets.length}`);
  
  for (const sheet of workbook.worksheets) {
    console.log(`\n--- Sheet: "${sheet.name}" ---`);
    console.log(`Row count: ${sheet.actualRowCount}`);
    
    // Show first 15 rows
    for (let i = 1; i <= Math.min(15, sheet.actualRowCount); i++) {
      const row = sheet.getRow(i);
      const values = row.values;
      if (values && values.length > 1) {
        console.log(`Row ${i}:`, values.slice(1, 7).join(' | '));
      }
    }
  }
}

const files = [
  'c:\\Users\\Amir\\Downloads\\gwt-audit-buddy\\pasigcity.gov.ph_audit_2026-04-13.xlsx',
  'c:\\Users\\Amir\\Downloads\\gwt-audit-buddy\\www.marikina.gov.ph_audit_2026-04-13.xlsx',
];

(async () => {
  for (const file of files) {
    try {
      await inspectExcel(file);
    } catch (err) {
      console.error(`Error reading ${file}:`, err.message);
    }
  }
})();
