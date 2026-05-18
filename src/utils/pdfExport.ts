/**
 * PDF export utility - loads jsPDF and html2canvas dynamically at runtime
 * Generates professional compliance reports with KPIs, insights, and visualizations
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

interface PDFMetadata {
  period?: string;
  statistics?: {
    current: number;
    highest: number;
    lowest: number;
    average: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  };
  insight?: string;
  /**
   * When true, render a richer, sectioned compliance download layout (download-only)
   * instead of the legacy layout.
   */
  complianceDownloadLayout?: boolean;
}

export async function generatePDF(
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
    await new Promise((resolve) => setTimeout(resolve, PDF_CONFIG.CHART_RENDER_DELAY));

    // Capture the element (chart area)
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

    const isComplianceDownloadLayout = Boolean(metadata?.complianceDownloadLayout);

    // ========== Page 1: Header + (either download-only layout or legacy layout) ==========

    pdf.setFontSize(22);
    pdf.setTextColor(37, 99, 235); // Blue
    pdf.text('Compliance Trend Report', 15, yPosition);

    yPosition += 8;

    // Period and Date info
    pdf.setFontSize(11);
    pdf.setTextColor(100, 116, 139); // Slate gray
    if (metadata?.period) {
      pdf.text(`Report Period: ${metadata.period}`, 15, yPosition);
      yPosition += 6;
    }
    pdf.text(
      `Generated: ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`,
      15,
      yPosition
    );

    yPosition += 12;

    // ========== Download-only richer layout ==========
    if (isComplianceDownloadLayout) {
      // Executive Summary
      pdf.setFontSize(12);
      pdf.setTextColor(15, 23, 42); // Slate-900
      pdf.setFont(undefined, 'bold');
      pdf.text('Executive Summary', 15, yPosition);
      yPosition += 7;

      pdf.setFontSize(10);
      pdf.setTextColor(71, 85, 105); // Slate-600
      pdf.setFont(undefined, 'normal');

      const execSummaryText =
        metadata?.insight ||
        'This report tracks whether overall government website compliance is improving, flattening, or slipping across recent audits.';
      const execSummaryLines = pdf.splitTextToSize(execSummaryText, pdfWidth - 30);
      pdf.text(execSummaryLines, 15, yPosition);
      yPosition += execSummaryLines.length * 4 + 10;

      // Audit Scope & Assumptions
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont(undefined, 'bold');
      pdf.text('Audit Scope & Assumptions', 15, yPosition);
      yPosition += 6;

      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.setFont(undefined, 'normal');

      const scopeText = [
        'Scope: Compliance Trend data aggregated across audited agencies for the selected date range.',
        'Method: Scores are averaged over time to show overall direction (improving / stable / declining).',
        'Assumptions: Report reflects the audits available at generation time; incomplete or missing days may reduce apparent accuracy.',
      ];
      const scopeLines = scopeText.flatMap((t) => pdf.splitTextToSize(t, pdfWidth - 30));
      pdf.text(scopeLines, 15, yPosition);
      yPosition += scopeLines.length * 4 + 6;

      // Standards & Methodology
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont(undefined, 'bold');
      pdf.text('Standards & Methodology', 15, yPosition);
      yPosition += 6;

      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.setFont(undefined, 'normal');

      const stdText = [
        'Evaluation focuses on accessibility and usability compliance checks used by the audit pipeline.',
        'KPI thresholds: Excellent (80-100%), Moderate (50-79%), Needs Improvement (<50%).',
      ];
      const stdLines = stdText.flatMap((t) => pdf.splitTextToSize(t, pdfWidth - 30));
      pdf.text(stdLines, 15, yPosition);
      yPosition += stdLines.length * 4 + 10;

      // Overall Results (scorecard)
      pdf.setFontSize(12);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont(undefined, 'bold');
      pdf.text('Overall Results', 15, yPosition);
      yPosition += 7;

      if (metadata?.statistics) {
        const stats = metadata.statistics;
        const colWidth = (pdfWidth - 30) / 4;
        const startX = 15;

        const drawKPIBoxSimple = (x: number, label: string, value: string) => {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(x, yPosition - 4, colWidth - 2, 14, 'F');
          pdf.setDrawColor(226, 232, 240);
          pdf.rect(x, yPosition - 4, colWidth - 2, 14);

          pdf.setFontSize(8);
          pdf.setTextColor(71, 85, 105);
          pdf.setFont(undefined, 'normal');
          pdf.text(label, x + 2, yPosition + 2);

          pdf.setFontSize(12);
          pdf.setTextColor(15, 23, 42);
          pdf.setFont(undefined, 'bold');
          pdf.text(value, x + colWidth / 2 - 3, yPosition + 9);
        };

        drawKPIBoxSimple(startX, 'Current', `${stats.current.toFixed(1)}%`);
        drawKPIBoxSimple(startX + colWidth, 'Highest', `${stats.highest.toFixed(1)}%`);
        drawKPIBoxSimple(startX + colWidth * 2, 'Lowest', `${stats.lowest.toFixed(1)}%`);
        drawKPIBoxSimple(
          startX + colWidth * 3,
          'Change',
          `${stats.change > 0 ? '+' : ''}${stats.change.toFixed(1)}%`
        );

        yPosition += 20;
      }

      // Prioritized Remediation Plan (concise text)
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont(undefined, 'bold');
      pdf.text('Prioritized Remediation Plan', 15, yPosition);
      yPosition += 6;

      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.setFont(undefined, 'normal');

      const current = metadata?.statistics?.current ?? 0;
      const remediationBullets =
        current >= 80
          ? [
              '1) Maintain: ensure key pages remain stable after updates/regressions.',
              '2) Expand: target advanced accessibility enhancements and consistent keyboard UX.',
              '3) Share: distribute best practices across agencies.',
            ]
          : current >= 50
            ? [
                '1) Prioritize: fix high-impact issues first to reach the 80% threshold.',
                '2) Validate: retest after changes to confirm improvements stick.',
                '3) Focus: mobile responsiveness + accessibility barriers.',
              ]
            : [
                '1) Re-audit: run a comprehensive accessibility audit for critical user journeys.',
                '2) Document: capture barriers and map them to remediation owners.',
                '3) Roadmap: create a prioritized improvement plan + recheck after each phase.',
              ];

      const remediationLines = remediationBullets.flatMap((b) => pdf.splitTextToSize(b, pdfWidth - 30));
      pdf.text(remediationLines, 15, yPosition);
      yPosition += remediationLines.length * 4 + 8;

      // Findings (placeholder summary)
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont(undefined, 'bold');
      pdf.text('Findings', 15, yPosition);
      yPosition += 6;

      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.setFont(undefined, 'normal');

      const findingsLines = pdf.splitTextToSize(
        'Detailed per-page findings are available in the underlying audit results. This trend report summarizes overall movement across audited agencies.',
        pdfWidth - 30
      );
      pdf.text(findingsLines, 15, yPosition);
      yPosition += findingsLines.length * 4 + 10;

      // Appendix
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont(undefined, 'bold');
      pdf.text('Appendix', 15, yPosition);
      yPosition += 6;

      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.setFont(undefined, 'normal');

      const appendixLines = pdf.splitTextToSize(
        'Legend: Excellent (80-100%), Moderate (50-79%), Needs Improvement (<50%). Reference chart shows the average compliance score over time.',
        pdfWidth - 30
      );
      pdf.text(appendixLines, 15, yPosition);

      // Move to next page for the chart
      pdf.addPage();
      yPosition = PDF_CONFIG.MARGINS.TOP;
    }

    // ========== Legacy layout ==========
    if (!isComplianceDownloadLayout) {
      pdf.setFontSize(12);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont(undefined, 'bold');
      pdf.text('Key Performance Indicators', 15, yPosition);

      yPosition += 8;

      if (metadata?.statistics) {
        const stats = metadata.statistics;
        const colWidth = (pdfWidth - 30) / 4;
        const startX = 15;

        const drawKPIBox = (x: number, label: string, value: string, unit: string, color: string) => {
          pdf.setFillColor(...hexToRgb(color));
          pdf.rect(x, yPosition - 6, colWidth - 2, 18, 'F');

          pdf.setDrawColor(...hexToRgb(color));
          pdf.rect(x, yPosition - 6, colWidth - 2, 18);

          pdf.setFontSize(8);
          pdf.setTextColor(71, 85, 105);
          pdf.setFont(undefined, 'normal');
          pdf.text(label, x + 2, yPosition - 2);

          pdf.setFontSize(14);
          pdf.setFont(undefined, 'bold');

          if (color === '#e5e7eb' && stats.current < 50) {
            pdf.setTextColor(220, 38, 38); // Red
          } else if (color === '#e5e7eb' && stats.current < 80) {
            pdf.setTextColor(217, 119, 6); // Orange
          } else if (color === '#e5e7eb') {
            pdf.setTextColor(34, 197, 94); // Green
          }

          pdf.text(value, x + colWidth / 2 - 3, yPosition + 4);

          pdf.setFontSize(7);
          pdf.setTextColor(107, 114, 128);
          pdf.text(unit, x + colWidth / 2 + 2, yPosition + 4);
        };

        drawKPIBox(startX, 'Current Score', stats.current.toFixed(1), '%', '#e5e7eb');
        drawKPIBox(startX + colWidth, 'Highest', stats.highest.toFixed(1), '%', '#d1fae5');
        drawKPIBox(startX + colWidth * 2, 'Lowest', stats.lowest.toFixed(1), '%', '#fed7aa');
        drawKPIBox(
          startX + colWidth * 3,
          'Change',
          (stats.change > 0 ? '+' : '') + stats.change.toFixed(1),
          '%',
          '#e0e7ff'
        );

        yPosition += 25;
      }

      // Color Legend
      yPosition += 5;
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont(undefined, 'bold');
      pdf.text('Compliance Score Levels', 15, yPosition);

      yPosition += 7;

      const legendItems = [
        { color: '#22c55e', range: '80-100%', status: 'Excellent' },
        { color: '#eab308', range: '50-79%', status: 'Moderate' },
        { color: '#ef4444', range: '< 50%', status: 'Needs Improvement' },
      ];

      pdf.setFontSize(9);
      legendItems.forEach((item) => {
        pdf.setFillColor(...hexToRgb(item.color));
        pdf.rect(15, yPosition - 2, 3, 3, 'F');
        pdf.setTextColor(71, 85, 105);
        pdf.text(`${item.range} - ${item.status}`, 20, yPosition);
        yPosition += 5;
      });

      yPosition += 8;

      // Recommendations
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont(undefined, 'bold');
      pdf.text('Recommendations', 15, yPosition);

      yPosition += 6;

      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.setFont(undefined, 'normal');

      let recommendation = '';
      if (metadata?.statistics?.current && metadata.statistics.current >= 80) {
        recommendation =
          'Excellent performance! Continue maintaining these high standards and explore opportunities for advanced accessibility features. Share best practices across agencies.';
      } else if (metadata?.statistics?.current && metadata.statistics.current >= 50) {
        recommendation =
          'Good progress is evident. Focus on high-impact improvements to reach the "Excellent" threshold of 80%. Prioritize accessibility and mobile responsiveness issues.';
      } else {
        recommendation =
          'Significant opportunity for improvement. Conduct a comprehensive accessibility audit, document barriers, and create a prioritized improvement roadmap. Consider training and resources.';
      }

      const recommendationLines = pdf.splitTextToSize(recommendation, pdfWidth - 30);
      pdf.text(recommendationLines, 15, yPosition);

      yPosition += recommendationLines.length * 4 + 15;
    }

    // ========== Chart Page ==========
    if (yPosition > pdfHeight - 50) {
      pdf.addPage();
      yPosition = PDF_CONFIG.MARGINS.TOP;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont(undefined, 'bold');
    pdf.text('Performance Trend', 15, yPosition);

    yPosition += 10;

    const margin = 15;
    const chartWidth = pdfWidth - 2 * margin;
    const chartHeight = (canvas.height / canvas.width) * chartWidth;

    pdf.addImage(imgData, 'PNG', margin, yPosition, chartWidth, chartHeight);

    yPosition += chartHeight + 10;

    if (yPosition > pdfHeight - 20) {
      pdf.addPage();
    }

    // Footer page numbers
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184); // Slate-400
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i += 1) {
      pdf.setPage(i);
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pdfWidth / 2,
        pdf.internal.pageSize.getHeight() - 5,
        { align: 'center' }
      );
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  if (result) {
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
  }
  return [0, 0, 0];
}
