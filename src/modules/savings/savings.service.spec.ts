import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { PrismaService } from '../../database/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';

describe('SavingsService', () => {
  let service: SavingsService;

  const mockPrisma = {
    savingsAccount: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockTransactionsService = {
    createTransaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavingsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TransactionsService, useValue: mockTransactionsService },
      ],
    }).compile();

    service = module.get<SavingsService>(SavingsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback) =>
      callback(mockPrisma),
    );
  });

  describe('withdraw', () => {
    const currentUser = { id: 'agent-1', role: 'Agent', branchId: 'branch-a' };

    it('devrait rejeter un retrait si le solde est insuffisant', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([
            {
              id: 'acc-1',
              balance: '1000',
              clientId: 'client-1',
              accountNumber: 'SAV-001',
            },
          ]),
        };
        return callback(tx);
      });

      await expect(
        service.withdraw(
          'acc-1',
          { amount: 5000, idempotencyKey: 'k1' },
          currentUser,
        ),
      ).rejects.toThrow(BadRequestException);

      // Aucune ecriture ne doit avoir eu lieu si le solde est insuffisant
      expect(mockTransactionsService.createTransaction).not.toHaveBeenCalled();
    });

    it("devrait lever une exception si le compte n'existe pas ou est ferme", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
        return callback(tx);
      });

      await expect(
        service.withdraw(
          'inconnu',
          { amount: 1000, idempotencyKey: 'k2' },
          currentUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
