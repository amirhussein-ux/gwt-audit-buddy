/**
 * PDF export utility - loads jsPDF and html2canvas dynamically at runtime
 * Generates professional compliance reports with KPIs, insights, and visualizations
 */

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
    await new Promise(resolve => setTimeout(resolve, 500));

    // Capture the element
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');

    // Create PDF - Portrait with more space for content
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 15;

    // ========== Page 1: Title and Summary ==========

    // Logo/Header
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
    pdf.text(`Generated: ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`, 15, yPosition);

    yPosition += 12;

    // Executive Summary
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42); // Slate-900
    pdf.setFont(undefined, 'bold');
    pdf.text('Executive Summary', 15, yPosition);

    yPosition += 7;

    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105); // Slate-600
    pdf.setFont(undefined, 'normal');

    if (metadata?.insight) {
      // Wrap text for insight
      const insightLines = pdf.splitTextToSize(metadata.insight, pdfWidth - 30);
      pdf.text(insightLines, 15, yPosition);
      yPosition += insightLines.length * 5 + 5;
    }

    // Key Performance Indicators
    yPosition += 2;
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont(undefined, 'bold');
    pdf.text('Key Performance Indicators', 15, yPosition);

    yPosition += 8;

    if (metadata?.statistics) {
      const stats = metadata.statistics;
      const colWidth = (pdfWidth - 30) / 4;
      const startX = 15;

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
        // Determine text color based on metric
        if (color === '#e5e7eb' && stats.current < 50) {
          pdf.setTextColor(220, 38, 38); // Red
        } else if (color === '#e5e7eb' && stats.current < 80) {
          pdf.setTextColor(217, 119, 6); // Orange
        } else if (color === '#e5e7eb') {
          pdf.setTextColor(34, 197, 94); // Green
        }
        pdf.text(value, x + colWidth / 2 - 3, yPosition + 4);

        // Unit
        pdf.setFontSize(7);
        pdf.setTextColor(107, 114, 128);
        pdf.text(unit, x + colWidth / 2 + 2, yPosition + 4);
      };

      drawKPIBox(startX, 'Current Score', stats.current.toFixed(1), '%', '#e5e7eb');
      drawKPIBox(startX + colWidth, 'Highest', stats.highest.toFixed(1), '%', '#d1fae5');
      drawKPIBox(startX + colWidth * 2, 'Lowest', stats.lowest.toFixed(1), '%', '#fed7aa');
      drawKPIBox(startX + colWidth * 3, 'Change', (stats.change > 0 ? '+' : '') + stats.change.toFixed(1), '%', '#e0e7ff');

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
    legendItems.forEach((item, index) => {
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
      recommendation = 'Excellent performance! Continue maintaining these high standards and explore opportunities for advanced accessibility features. Share best practices across agencies.';
    } else if (metadata?.statistics?.current && metadata.statistics.current >= 50) {
      recommendation = 'Good progress is evident. Focus on high-impact improvements to reach the "Excellent" threshold of 80%. Prioritize accessibility and mobile responsiveness issues.';
    } else {
      recommendation = 'Significant opportunity for improvement. Conduct a comprehensive accessibility audit, document barriers, and create a prioritized improvement roadmap. Consider training and resources.';
    }

    const recommendationLines = pdf.splitTextToSize(recommendation, pdfWidth - 30);
    pdf.text(recommendationLines, 15, yPosition);

    yPosition += recommendationLines.length * 4 + 15;

    // Add page break if needed
    if (yPosition > pdfHeight - 40) {
      pdf.addPage();
      yPosition = 15;
    }

    // ========== Chart Page ==========
    if (yPosition > pdfHeight - 50) {
      pdf.addPage();
      yPosition = 15;
    }

    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.setFont(undefined, 'bold');
    pdf.text('Performance Trend', 15, yPosition);

    yPosition += 10;

    // Add chart image
    const margin = 15;
    const chartWidth = pdfWidth - 2 * margin;
    const chartHeight = (canvas.height / canvas.width) * chartWidth;

    pdf.addImage(imgData, 'PNG', margin, yPosition, chartWidth, chartHeight);

    // Add footer on last page
    yPosition += chartHeight + 10;

    if (yPosition > pdfHeight - 20) {
      pdf.addPage();
    }

    // Footer
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
    console.error('Error generating PDF:', error);
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
