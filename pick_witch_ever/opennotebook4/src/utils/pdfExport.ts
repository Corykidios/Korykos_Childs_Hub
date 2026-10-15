import html2pdf from 'html2pdf.js';

export interface ReportPdfExportOptions {
  title: string;
  formatTitle: string;
  notebookTitle?: string;
  sourceCount?: number;
  wordCount: number;
  readTime: number;
  contentElement: HTMLElement | null;
  markdownContent?: string;
}

/**
 * High-resolution Print / Vector PDF exporter.
 * Renders document into an isolated iframe styled for A4 print and triggers window.print().
 * Preserves 100% vector typography, vector KaTeX mathematical equations, tables, and page breaks.
 */
export const printReportAsPdf = (options: ReportPdfExportOptions) => {
  const {
    title,
    formatTitle,
    notebookTitle,
    sourceCount = 1,
    wordCount,
    readTime,
    contentElement,
  } = options;

  if (!contentElement) {
    window.print();
    return;
  }

  // Create an isolated printable iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  // Clone rendered HTML content with KaTeX elements
  const clonedContent = contentElement.cloneNode(true) as HTMLElement;

  // Build the complete printable HTML page
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
      <style>
        @page {
          size: A4;
          margin: 18mm 16mm 18mm 16mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #111827;
          background: #ffffff !important;
          line-height: 1.65;
          font-size: 11pt;
          margin: 0;
          padding: 0;
        }
        .report-header {
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 1.25rem;
          margin-bottom: 2rem;
          break-after: avoid;
        }
        .report-badge {
          display: inline-block;
          font-size: 8.5pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #b45309;
          background: #fef3c7;
          border: 1px solid #fde68a;
          padding: 3px 10px;
          border-radius: 6px;
          margin-bottom: 8px;
        }
        .report-title {
          font-size: 20pt;
          font-weight: 800;
          color: #0f172a;
          margin: 0.35rem 0 0.5rem 0;
          line-height: 1.25;
          letter-spacing: -0.02em;
          break-after: avoid;
        }
        .report-meta {
          font-size: 9pt;
          color: #6b7280;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 6px;
        }
        .report-meta-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        h1, h2, h3, h4, h5, h6 {
          color: #0f172a;
          break-after: avoid;
        }
        h1 {
          font-size: 18pt;
          font-weight: 800;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 6px;
          margin-top: 1.8rem;
          margin-bottom: 0.8rem;
        }
        h2 {
          font-size: 14pt;
          font-weight: 700;
          color: #1e293b;
          margin-top: 1.5rem;
          margin-bottom: 0.6rem;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 4px;
        }
        h3 {
          font-size: 12pt;
          font-weight: 600;
          color: #334155;
          margin-top: 1.2rem;
          margin-bottom: 0.4rem;
        }
        p {
          margin: 0.75rem 0;
          color: #1f2937;
          text-align: justify;
        }
        ul, ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
          color: #1f2937;
        }
        li {
          margin-bottom: 0.35rem;
        }
        blockquote {
          border-left: 4px solid #d97706;
          background: #fffbeb;
          padding: 10px 16px;
          margin: 1.2rem 0;
          border-radius: 0 8px 8px 0;
          color: #451a03;
          font-size: 10.5pt;
          break-inside: avoid;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.4rem 0;
          font-size: 9.5pt;
          break-inside: avoid;
        }
        th, td {
          border: 1px solid #d1d5db;
          padding: 8px 12px;
          text-align: left;
        }
        th {
          background: #f3f4f6;
          font-weight: 700;
          color: #111827;
        }
        tr:nth-child(even) td {
          background: #f9fafb;
        }
        /* KaTeX styles for vector math */
        .katex {
          font-size: 1.08em;
          color: #0f172a;
        }
        .katex-display {
          margin: 1.2rem 0;
          break-inside: avoid;
          text-align: center;
          padding: 6px 0;
        }
        code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 9pt;
          background: #f3f4f6;
          padding: 2px 5px;
          border-radius: 4px;
          color: #0f172a;
        }
        pre {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 9pt;
          break-inside: avoid;
        }
        .report-footer {
          margin-top: 3rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
          font-size: 8.5pt;
          color: #9ca3af;
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <div class="report-header">
        <div class="report-badge">${formatTitle}</div>
        <div class="report-title">${title}</div>
        <div class="report-meta">
          <span class="report-meta-item"><strong>Grounded Sources:</strong> ${sourceCount} document${sourceCount === 1 ? '' : 's'}</span>
          ${notebookTitle ? `<span class="report-meta-item">• <strong>Notebook:</strong> ${notebookTitle}</span>` : ''}
          <span class="report-meta-item">• <strong>Length:</strong> ${wordCount.toLocaleString()} words (~${readTime} min read)</span>
          <span class="report-meta-item">• <strong>Date:</strong> ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>
      <div id="report-content">
        ${clonedContent.innerHTML}
      </div>
      <div class="report-footer">
        <span>Generated with OpenNotebookLM Synthesis Engine</span>
        <span>Confidential & Grounded Research Document</span>
      </div>
    </body>
    </html>
  `);
  doc.close();

  // Wait for KaTeX CSS and webfonts to settle then print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Iframe print failed, falling back to window.print():', e);
      window.print();
    } finally {
      // Clean up after print dialog finishes
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 5000);
    }
  }, 400);
};

/**
 * Direct .PDF file download using html2pdf.js.
 * Automatically saves a styled PDF to the user's download directory.
 */
export const downloadReportAsPdfFile = async (options: ReportPdfExportOptions): Promise<void> => {
  const {
    title,
    formatTitle,
    notebookTitle,
    sourceCount = 1,
    wordCount,
    readTime,
    contentElement,
  } = options;

  if (!contentElement) {
    printReportAsPdf(options);
    return;
  }

  // Create an offscreen wrapper with pristine white document styling
  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-export-container';
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0';
  wrapper.style.width = '794px'; // Standard A4 at 96 DPI
  wrapper.style.background = '#ffffff';
  wrapper.style.color = '#111827';
  wrapper.style.padding = '40px 48px';
  wrapper.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  wrapper.style.fontSize = '14px';
  wrapper.style.lineHeight = '1.6';

  const cloned = contentElement.cloneNode(true) as HTMLElement;

  wrapper.innerHTML = `
    <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px;">
      <div style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; padding: 3px 10px; border-radius: 6px; margin-bottom: 8px;">
        ${formatTitle}
      </div>
      <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 4px 0 8px 0; line-height: 1.25; letter-spacing: -0.02em;">
        ${title}
      </h1>
      <div style="font-size: 12px; color: #6b7280; display: flex; flex-wrap: wrap; gap: 10px;">
        <span><strong>Grounded Sources:</strong> ${sourceCount} document${sourceCount === 1 ? '' : 's'}</span>
        ${notebookTitle ? `<span>• <strong>Notebook:</strong> ${notebookTitle}</span>` : ''}
        <span>• <strong>Length:</strong> ${wordCount.toLocaleString()} words</span>
        <span>• <strong>Date:</strong> ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
    </div>
    <div class="pdf-export-body">
      ${cloned.innerHTML}
    </div>
    <div style="margin-top: 36px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between;">
      <span>Generated with OpenNotebookLM Synthesis Engine</span>
      <span>Confidential & Grounded Research Document</span>
    </div>
  `;

  // Apply light theme text colors to all children
  wrapper.querySelectorAll('*').forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.tagName === 'H1' || htmlEl.tagName === 'H2' || htmlEl.tagName === 'H3' || htmlEl.tagName === 'H4') {
      htmlEl.style.color = '#0f172a';
      htmlEl.style.breakAfter = 'avoid';
    } else if (htmlEl.tagName === 'P' || htmlEl.tagName === 'LI') {
      htmlEl.style.color = '#1f2937';
    } else if (htmlEl.tagName === 'BLOCKQUOTE') {
      htmlEl.style.borderLeft = '4px solid #d97706';
      htmlEl.style.background = '#fffbeb';
      htmlEl.style.color = '#451a03';
      htmlEl.style.padding = '10px 16px';
      htmlEl.style.margin = '16px 0';
      htmlEl.style.borderRadius = '0 8px 8px 0';
    } else if (htmlEl.tagName === 'TABLE') {
      htmlEl.style.width = '100%';
      htmlEl.style.borderCollapse = 'collapse';
      htmlEl.style.margin = '16px 0';
    } else if (htmlEl.tagName === 'TH') {
      htmlEl.style.background = '#f3f4f6';
      htmlEl.style.color = '#111827';
      htmlEl.style.border = '1px solid #d1d5db';
      htmlEl.style.padding = '8px 12px';
      htmlEl.style.fontWeight = '700';
    } else if (htmlEl.tagName === 'TD') {
      htmlEl.style.border = '1px solid #d1d5db';
      htmlEl.style.padding = '8px 12px';
      htmlEl.style.color = '#1f2937';
    }
  });

  document.body.appendChild(wrapper);

  const cleanFilename = (title || 'Report')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);

  const opt = {
    margin: [12, 12, 12, 12],
    filename: `${cleanFilename}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
      windowWidth: 794,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
    },
    pagebreak: {
      mode: ['avoid-all', 'css', 'legacy'],
      avoid: ['h1', 'h2', 'h3', 'table', 'blockquote', '.katex-display'],
    },
  };

  try {
    // @ts-ignore
    await html2pdf().set(opt).from(wrapper).save();
  } catch (err) {
    console.warn('html2pdf direct download failed, falling back to print dialog:', err);
    printReportAsPdf(options);
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
};
