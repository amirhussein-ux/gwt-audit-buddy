/**
 * Leaderboard PDF export utility
 * Generates professional agency ranking reports
 */

// Constants
const PDF_CONFIG = {
  CHART_RENDER_DELAY: 500, // ms to wait for chart to fully render
  CANVAS_OPTIONS: {
    SCALE: 2,
    BACKGROUND_COLOR: '#ffffff',
    USE_CORS: true,
    ALLOW_TAINT: true,
    LOGGING: false,
  },
  JSPDF_OPTIONS: {
    orientation: 'portrait' as const,
    unit: 'mm' as const,
    format: 'a4' as const,
  },
  MARGINS: {
    TOP: 15,
    BOTTOM: 15,
    LEFT: 10,
    RIGHT: 10,
  },
};

interface LeaderboardEntry {
  rank: number;
  agency: {
    _id: string;
    name: string;
    acronym: string;
  };
  overallScore: number;
}

interface LeaderboardStats {
  topScore: number;
  averageScore: number;
  lowestScore: number;
  excellentCount: number;
  performanceInsight: string;
  gapAnalysis: string;
}

interface PDFMetadata {
  leaderboard?: LeaderboardEntry[];
  stats?: LeaderboardStats;
}

export async function generateLeaderboardPDF(
  element: HTMLElement,
  filename: string,
  metadata?: PDFMetadata
) {
  try {
    // Import with string literals (required for Vite to resolve)
    const jsPDFModule = await import('jspdf');
    const html2canvasModule = await import('html2canvas');

    const jsPDF = jsPDFModule.jsPDF;
    const html2canvas = html2canvasModule.default;

    // Wait for chart to fully render
    await new Promise(resolve => setTimeout(resolve, PDF_CONFIG.CHART_RENDER_DELAY));

    // Capture the element
    const canvas = await html2canvas(element, {
      backgroundColor: PDF_CONFIG.CANVAS_OPTIONS.BACKGROUND_COLOR,
      scale: PDF_CONFIG.CANVAS_OPTIONS.SCALE,
      useCORS: PDF_CONFIG.CANVAS_OPTIONS.USE_CORS,
      allowTaint: PDF_CONFIG.CANVAS_OPTIONS.ALLOW_TAINT,
      logging: PDF_CONFIG.CANVAS_OPTIONS.LOGGING,
      ignoreElements: (currentElement) =>
        currentElement instanceof HTMLElement && currentElement.dataset.exportIgnore === 'true',
    });

    const imgData = canvas.toDataURL('image/png');

    // Create PDF - Portrait
    const pdf = new jsPDF(PDF_CONFIG.JSPDF_OPTIONS);

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    let yPosition = PDF_CONFIG.MARGINS.TOP;

    // ========== Page 1: Title & Summary ==========

    // Header
    pdf.setFontSize(22);
    pdf.setTextColor(37, 99, 235); // Blue
    pdf.text('Agency Performance Leaderboard', PDF_CONFIG.MARGINS.LEFT, yPosition);

    yPosition += 8;

    // Date info
    pdf.setFontSize(11);
    pdf.setTextColor(100, 116, 139); // Slate gray
    pdf.text(`Report Generated: ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`, PDF_CONFIG.MARGINS.LEFT, yPosition);

    yPosition += 12;

    // Executive Summary
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42); // Slate-900
    pdf.setFont(undefined, 'bold');
    pdf.text('Executive Summary', PDF_CONFIG.MARGINS.LEFT, yPosition);

    yPosition += 7;

    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105); // Slate-600
    pdf.setFont(undefined, 'normal');

    if (metadata?.stats?.performanceInsight) {
      const summaryLines = pdf.splitTextToSize(metadata.stats.performanceInsight, pdfWidth - (PDF_CONFIG.MARGINS.LEFT + PDF_CONFIG.MARGINS.RIGHT));
      pdf.text(summaryLines, PDF_CONFIG.MARGINS.LEFT, yPosition);
      yPosition += summaryLines.length * 5 + 5;
    }

    // Key Metrics
    yPosition += 2;
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont(undefined, 'bold');
    pdf.text('Key Performance Metrics', PDF_CONFIG.MARGINS.LEFT, yPosition);

    yPosition += 8;

    if (metadata?.stats) {
      const stats = metadata.stats;
      const colWidth = (pdfWidth - (PDF_CONFIG.MARGINS.LEFT + PDF_CONFIG.MARGINS.RIGHT)) / 4;
      const startX = PDF_CONFIG.MARGINS.LEFT;

      // KPI Box styling function
      const drawKPIBox = (x: number, label: string, value: string, unit: string, color: string) => {
        // Box background
        pdf.setFillColor(...hexToRgb(color));
        pdf.rect(x, yPosition - 6, colWidth - 2, 18, 'F');

        // Border
        pdf.setDrawColor(...hexToRgb(color));
        pdf.rect(x, yPosition - 6, colWidth - 2, 18);

        // Label
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.setFont(undefined, 'normal');
        pdf.text(label, x + 2, yPosition - 2);

        // Value
        pdf.setFontSize(14);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(34, 197, 94); // Green by default
        pdf.text(value, x + colWidth / 2 - 3, yPosition + 4);

        // Unit
        pdf.setFontSize(7);
        pdf.setTextColor(107, 114, 128);
        pdf.text(unit, x + colWidth / 2 + 2, yPosition + 4);
      };

      drawKPIBox(startX, 'Top Score', stats.topScore.toFixed(1), '%', '#dcfce7');
      drawKPIBox(startX + colWidth, 'Average', stats.averageScore.toFixed(1), '%', '#dbeafe');
      drawKPIBox(startX + colWidth * 2, 'Lowest', stats.lowestScore.toFixed(1), '%', '#fed7aa');
      drawKPIBox(startX + colWidth * 3, 'Elite Tier', stats.excellentCount.toString(), 'agencies', '#e9d5ff');

      yPosition += 25;
    }

    // Performance Tiers
    yPosition += 5;
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont(undefined, 'bold');
    pdf.text('Performance Tiers', PDF_CONFIG.MARGINS.LEFT, yPosition);

    yPosition += 7;

    const tierItems = [
      { color: '#22c55e', range: '85-100%', status: 'Elite Performer' },
      { color: '#2563eb', range: '70-84%', status: 'Strong Performer' },
      { color: '#eab308', range: '55-69%', status: 'Developing' },
      { color: '#ef4444', range: '<55%', status: 'Emerging Performer' },
    ];

    pdf.setFontSize(9);
    tierItems.forEach((item, index) => {
      pdf.setFillColor(...hexToRgb(item.color));
      pdf.rect(PDF_CONFIG.MARGINS.LEFT, yPosition - 2, 3, 3, 'F');
      pdf.setTextColor(71, 85, 105);
      pdf.text(`${item.range} — ${item.status}`, PDF_CONFIG.MARGINS.LEFT + 5, yPosition);
      yPosition += 5;
    });

    yPosition += 8;

    // Gap Analysis
    if (metadata?.stats?.gapAnalysis) {
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont(undefined, 'bold');
      pdf.text('Performance Gap Analysis', PDF_CONFIG.MARGINS.LEFT, yPosition);

      yPosition += 6;

      pdf.setFontSize(9);
      pdf.setFont(undefined, 'normal');
      pdf.setTextColor(71, 85, 105);
      const gapLines = pdf.splitTextToSize(metadata.stats.gapAnalysis, pdfWidth - (PDF_CONFIG.MARGINS.LEFT + PDF_CONFIG.MARGINS.RIGHT));
      pdf.text(gapLines, PDF_CONFIG.MARGINS.LEFT, yPosition);

      yPosition += gapLines.length * 4 + 5;
    }

    // Add page break if needed
    if (yPosition > pdfHeight - 50) {
      pdf.addPage();
      yPosition = PDF_CONFIG.MARGINS.TOP;
    }

    // ========== Ranking Chart Page ==========
    if (yPosition > pdfHeight - 50) {
      pdf.addPage();
      yPosition = PDF_CONFIG.MARGINS.TOP;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont(undefined, 'bold');
    pdf.text('Compliance Rankings Chart', PDF_CONFIG.MARGINS.LEFT, yPosition);

    yPosition += 10;

    // Add chart image
    const margin = PDF_CONFIG.MARGINS.LEFT;
    const chartWidth = pdfWidth - 2 * margin;
    const chartHeight = (canvas.height / canvas.width) * chartWidth;

    pdf.addImage(imgData, 'PNG', margin, yPosition, chartWidth, chartHeight);

    yPosition += chartHeight + 10;

    // ========== Page 3: Detailed Rankings ==========
    if (yPosition > pdfHeight - 60 || yPosition + 100 > pdfHeight) {
      pdf.addPage();
      yPosition = PDF_CONFIG.MARGINS.TOP;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont(undefined, 'bold');
    pdf.text('Detailed Rankings', PDF_CONFIG.MARGINS.LEFT, yPosition);

    yPosition += 10;

    if (metadata?.leaderboard && metadata.leaderboard.length > 0) {
      // Table headers
      pdf.setFontSize(9);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.setFillColor(37, 99, 235); // Blue header
      pdf.rect(PDF_CONFIG.MARGINS.LEFT, yPosition - 5, pdfWidth - (PDF_CONFIG.MARGINS.LEFT + PDF_CONFIG.MARGINS.RIGHT), 6, 'F');

      pdf.text('Rank', PDF_CONFIG.MARGINS.LEFT + 2, yPosition);
      pdf.text('Agency Name', 25, yPosition);
      pdf.text('Acronym', 140, yPosition);
      pdf.text('Score', 165, yPosition);
      pdf.text('Tier', 180, yPosition);

      yPosition += 8;

      pdf.setFont(undefined, 'normal');
      pdf.setTextColor(71, 85, 105);

      metadata.leaderboard.slice(0, 15).forEach((entry, index) => {
        if (yPosition > pdfHeight - 15) {
          pdf.addPage();
          yPosition = PDF_CONFIG.MARGINS.TOP;

          // Repeat headers on new page
          pdf.setFontSize(9);
          pdf.setFont(undefined, 'bold');
          pdf.setTextColor(255, 255, 255);
          pdf.setFillColor(37, 99, 235);
          pdf.rect(PDF_CONFIG.MARGINS.LEFT, yPosition - 5, pdfWidth - (PDF_CONFIG.MARGINS.LEFT + PDF_CONFIG.MARGINS.RIGHT), 6, 'F');

          pdf.text('Rank', PDF_CONFIG.MARGINS.LEFT + 2, yPosition);
          pdf.text('Agency Name', 25, yPosition);
          pdf.text('Acronym', 140, yPosition);
          pdf.text('Score', 165, yPosition);
          pdf.text('Tier', 180, yPosition);

          yPosition += 8;
          pdf.setFont(undefined, 'normal');
          pdf.setTextColor(71, 85, 105);
        }

        // Alternating row background
        if (index % 2 === 0) {
          pdf.setFillColor(245, 245, 245);
          pdf.rect(PDF_CONFIG.MARGINS.LEFT, yPosition - 4, pdfWidth - (PDF_CONFIG.MARGINS.LEFT + PDF_CONFIG.MARGINS.RIGHT), 5, 'F');
        }

        pdf.text(entry.rank.toString(), PDF_CONFIG.MARGINS.LEFT + 2, yPosition);
        pdf.text(entry.agency.name.substring(0, 35), 25, yPosition);
        pdf.text(entry.agency.acronym || '—', 140, yPosition);
        pdf.text(`${entry.overallScore.toFixed(1)}%`, 165, yPosition);

        // Tier label
        let tier = 'Emerging';
        if (entry.overallScore >= 85) tier = 'Elite';
        else if (entry.overallScore >= 70) tier = 'Strong';
        else if (entry.overallScore >= 55) tier = 'Dev.';
        pdf.text(tier, 180, yPosition);

        yPosition += 5;
      });
    }

    // Footer on all pages
    yPosition = pdfHeight - 10;
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184); // Slate-400
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pdfWidth / 2,
        pdf.internal.pageSize.getHeight() - 5,
        { align: 'center' }
      );
    }

    // Save PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error generating leaderboard PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
    ];
  }
  return [0, 0, 0];
}
