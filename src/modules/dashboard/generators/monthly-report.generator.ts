import PDFDocument from 'pdfkit';

interface MonthlyReportData {
  branchName: string;
  month: number;
  year: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalDisbursements: number;
  totalRepayments: number;
  loansAtRisk: number;
  overdueAmount: number;
}

export function generateMonthlyReportPdf(data: MonthlyReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(`Rapport mensuel - ${data.branchName}`, { align: 'center' });
    doc.fontSize(11).text(`${data.month}/${data.year}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(12);
    doc.text(`Depots : ${data.totalDeposits.toLocaleString('fr-FR')} FCFA`);
    doc.text(`Retraits : ${data.totalWithdrawals.toLocaleString('fr-FR')} FCFA`);
    doc.text(`Decaissements prets : ${data.totalDisbursements.toLocaleString('fr-FR')} FCFA`);
    doc.text(`Remboursements prets : ${data.totalRepayments.toLocaleString('fr-FR')} FCFA`);
    doc.moveDown();
    doc.text(`Prets a risque : ${data.loansAtRisk}`);
    doc.text(`Montant total en retard : ${data.overdueAmount.toLocaleString('fr-FR')} FCFA`);

    doc.end();
  });
}