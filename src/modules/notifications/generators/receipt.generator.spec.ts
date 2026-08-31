import { generateReceiptPdf } from './receipt.generator';

describe('generateReceiptPdf', () => {
  it('devrait generer un buffer PDF valide', async () => {
    const buffer = await generateReceiptPdf({
      transactionNumber: 'TXN-000001',
      type: 'DEPOSIT',
      amount: 5000,
      clientName: 'Test Client',
      clientNumber: 'LOM-01-000001',
      branchName: 'Agence Test',
      performedByName: 'Agent Test',
      createdAt: new Date(),
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // Un vrai fichier PDF commence toujours par cette signature binaire
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
