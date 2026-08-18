import PDFDocument from 'pdfkit';

interface ReceiptData {
  transactionNumber: string;
  type: string;
  amount: number;
  clientName: string;
  clientNumber: string;
  branchName: string;
  performedByName: string;
  createdAt: Date;
}

export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('AuTogo - Recu de transaction', { align: 'center' });
    doc.moveDown();
    doc
      .fontSize(10)
      .text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, {
        align: 'center',
      });
    doc.moveDown(2);

    doc.fontSize(12);
    doc.text(`Numero de transaction : ${data.transactionNumber}`);
    doc.text(`Type : ${data.type}`);
    doc.text(`Montant : ${data.amount.toLocaleString('fr-FR')} FCFA`);
    doc.moveDown();
    doc.text(`Client : ${data.clientName} (${data.clientNumber})`);
    doc.text(`Agence : ${data.branchName}`);
    doc.text(`Effectue par : ${data.performedByName}`);
    doc.text(`Date : ${data.createdAt.toLocaleString('fr-FR')}`);

    doc.moveDown(3);
    doc
      .fontSize(9)
      .text(
        "Ce recu est genere automatiquement et fait foi de l'operation effectuee.",
        { align: 'center' },
      );

    doc.end();
  });
}
