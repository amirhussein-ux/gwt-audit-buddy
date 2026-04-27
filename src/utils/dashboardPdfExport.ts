const PDF_CONFIG = {
  CHART_RENDER_DELAY: 400,
  PAGE_MARGIN: 14,
  SECTION_GAP: 8,
  CANVAS_OPTIONS: {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
  },
};

export interface DashboardPdfSection {
  title: string;
  description?: string;
  element: HTMLElement;
}

export async function exportDashboardSectionsToPdf(
  sections: DashboardPdfSection[],
  filename: string
) {
  if (sections.length === 0) {
    throw new Error('No sections selected for export.');
  }

  const jsPDFModule = await import('jspdf');
  const html2canvasModule = await import('html2canvas');
  const jsPDF = jsPDFModule.jsPDF;
  const html2canvas = html2canvasModule.default;

  await new Promise((resolve) => setTimeout(resolve, PDF_CONFIG.CHART_RENDER_DELAY));

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PDF_CONFIG.PAGE_MARGIN * 2;

  pdf.setFillColor(241, 245, 249);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  pdf.setFontSize(22);
  pdf.setTextColor(15, 23, 42);
  pdf.text('MASID Dashboard Reports', PDF_CONFIG.PAGE_MARGIN, 24);
  pdf.setFontSize(10);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `Generated on ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`,
    PDF_CONFIG.PAGE_MARGIN,
    31
  );

  let yPosition = 42;
  sections.forEach((section, index) => {
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(PDF_CONFIG.PAGE_MARGIN, yPosition - 4, contentWidth, 12, 4, 4, 'F');
    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`${index + 1}. ${section.title}`, PDF_CONFIG.PAGE_MARGIN + 4, yPosition + 3);
    yPosition += 16;
  });

  for (const section of sections) {
    pdf.addPage();
    pdf.setFillColor(248, 250, 252);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    pdf.setFontSize(18);
    pdf.setTextColor(15, 23, 42);
    pdf.text(section.title, PDF_CONFIG.PAGE_MARGIN, 20);

    if (section.description) {
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      const descriptionLines = pdf.splitTextToSize(section.description, contentWidth);
      pdf.text(descriptionLines, PDF_CONFIG.PAGE_MARGIN, 27);
    }

    const canvas = await html2canvas(section.element, {
      ...PDF_CONFIG.CANVAS_OPTIONS,
      ignoreElements: (element) =>
        element instanceof HTMLElement && element.dataset.exportIgnore === 'true',
    });

    const imageData = canvas.toDataURL('image/png');
    const imageHeight = (canvas.height / canvas.width) * contentWidth;
    const maxHeight = pageHeight - 42;

    if (imageHeight <= maxHeight) {
      pdf.addImage(imageData, 'PNG', PDF_CONFIG.PAGE_MARGIN, 36, contentWidth, imageHeight);
      continue;
    }

    const pageCanvas = document.createElement('canvas');
    const pageContext = pageCanvas.getContext('2d');
    if (!pageContext) {
      throw new Error('Failed to create canvas context for PDF export.');
    }

    const sliceHeightPx = Math.floor((maxHeight / contentWidth) * canvas.width);
    let sourceY = 0;
    let firstPage = true;

    while (sourceY < canvas.height) {
      const currentSliceHeight = Math.min(sliceHeightPx, canvas.height - sourceY);
      pageCanvas.width = canvas.width;
      pageCanvas.height = currentSliceHeight;
      pageContext.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageContext.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        currentSliceHeight,
        0,
        0,
        canvas.width,
        currentSliceHeight
      );

      const sliceHeightMm = (currentSliceHeight / canvas.width) * contentWidth;
      if (!firstPage) {
        pdf.addPage();
        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      }

      pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', PDF_CONFIG.PAGE_MARGIN, 36, contentWidth, sliceHeightMm);
      sourceY += currentSliceHeight;
      firstPage = false;
    }
  }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Page ${page} of ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  pdf.save(filename);
}
