import { Test, TestingModule } from '@nestjs/testing';
import { InterestProcessor } from './interest.processor';
import { PrismaService } from '../../database/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';

describe('InterestProcessor', () => {
  let processor: InterestProcessor;

  const mockPrisma = {
    savingsAccount: { findFirst: jest.fn(), update: jest.fn() },
    transaction: { findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockTransactionsService = {
    createTransaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterestProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TransactionsService, useValue: mockTransactionsService },
      ],
    }).compile();

    processor = module.get<InterestProcessor>(InterestProcessor);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback) =>
      callback(mockPrisma),
    );
  });

  it('ne devrait PAS modifier le solde si ce compte a deja ete traite ce mois-ci', async () => {
    mockPrisma.savingsAccount.findFirst.mockResolvedValue({
      id: 'acc-1',
      balance: 10000,
      status: 'ACTIVE',
      clientId: 'client-1',
    });
    // Simule qu'une transaction d'interet existe deja pour ce mois
    mockPrisma.transaction.findUnique.mockResolvedValue({ id: 'existing-txn' });

    await processor.process({ data: { accountId: 'acc-1' } } as any);

    // Le point le plus important : ni la creation de transaction, ni la mise a jour du solde ne doivent avoir lieu
    expect(mockTransactionsService.createTransaction).not.toHaveBeenCalled();
    expect(mockPrisma.savingsAccount.update).not.toHaveBeenCalled();
  });

  it("devrait appliquer l'interet si le compte n'a pas encore ete traite ce mois-ci", async () => {
    mockPrisma.savingsAccount.findFirst.mockResolvedValue({
      id: 'acc-1',
      balance: 10000,
      status: 'ACTIVE',
      clientId: 'client-1',
    });
    mockPrisma.transaction.findUnique.mockResolvedValue(null); // pas encore traite
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });

    await processor.process({ data: { accountId: 'acc-1' } } as any);

    expect(mockTransactionsService.createTransaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.savingsAccount.update).toHaveBeenCalledTimes(1);
  });
});
