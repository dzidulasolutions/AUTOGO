import PDFDocument from 'pdfkit';

interface PassbookEntry {
  label: string; // ex: "15 aout 2026" ou "Echeance 3"
  amount: number;
  status: string;
}

interface PassbookData {
  title: string; // ex: "Carnet Tontine TON-000001" ou "Echeancier Pret LOAN-000002"
  clientName: string;
  entries: PassbookEntry[];
  summary: {
    total: number;
    completed: number;
    pending: number;
    amountDone: number;
  };
}

export function generatePassbookPdf(data: PassbookData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(data.title, { align: 'center' });
    doc.fontSize(11).text(`Client : ${data.clientName}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(10);
    doc.text(
      `Progression : ${data.summary.completed} / ${data.summary.total} echeances`,
    );
    doc.text(
      `Montant collecte/paye : ${data.summary.amountDone.toLocaleString('fr-FR')} FCFA`,
    );
    doc.moveDown(1.5);

    // En-tete du tableau
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Echeance', 50, doc.y, { continued: true, width: 200 });
    doc.text('Montant', 250, doc.y, { continued: true, width: 150 });
    doc.text('Statut', 400, doc.y);
    doc.moveDown(0.5);
    doc.font('Helvetica');

    for (const entry of data.entries) {
      doc.text(entry.label, 50, doc.y, { continued: true, width: 200 });
      doc.text(`${entry.amount.toLocaleString('fr-FR')} FCFA`, 250, doc.y, {
        continued: true,
        width: 150,
      });
      doc.text(entry.status, 400, doc.y);
    }

    doc.end();
  });
}
