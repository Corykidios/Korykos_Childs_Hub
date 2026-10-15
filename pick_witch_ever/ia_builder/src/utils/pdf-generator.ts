import jsPDF from 'jspdf';

export interface PDFContent {
  title: string;
  subtitle?: string;
  content: string;
  footer?: string;
}

export function generatePDF({ title, subtitle, content, footer }: PDFContent): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPos = margin;

  // Título
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(124, 58, 237); // Cor roxa do tema
  doc.text(title, margin, yPos);
  yPos += 10;

  // Subtítulo
  if (subtitle) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, margin, yPos);
    yPos += 8;
  }

  // Linha separadora
  doc.setDrawColor(124, 58, 237);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Conteúdo
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  const lines = doc.splitTextToSize(content, maxWidth);
  
  for (const line of lines) {
    // Verificar se precisa de nova página
    if (yPos > doc.internal.pageSize.getHeight() - margin - 20) {
      doc.addPage();
      yPos = margin;
    }
    
    doc.text(line, margin, yPos);
    yPos += 6;
  }

  // Rodapé
  if (footer) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(footer, margin, doc.internal.pageSize.getHeight() - 10);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }
  }

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}

export async function sharePDF(doc: jsPDF, title: string): Promise<boolean> {
  const pdfBlob = doc.output('blob');
  const pdfFile = new File([pdfBlob], `${title}.pdf`, { type: 'application/pdf' });

  // Verificar se Web Share API está disponível e suporta arquivos
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: title,
        text: `Confira: ${title}`,
      });
      return true;
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      return false;
    }
  }

  return false;
}
