import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../../database/prisma.service';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const mockPrisma = {
    transaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrisma },
         { provide: 'BullQueue_pdf', useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback) =>
      callback(mockPrisma),
    );
  });

  describe('createTransaction - idempotence', () => {
    const currentUser = { id: 'agent-1', role: 'Agent', branchId: 'branch-a' };
    const dto = {
      clientId: 'client-1',
      type: 'DEPOSIT' as const,
      amount: 5000,
      idempotencyKey: 'key-001',
    };

    it('devrait renvoyer la transaction existante sans en creer une nouvelle si la cle existe deja', async () => {
      const existingTransaction = {
        id: 'txn-1',
        idempotencyKey: 'key-001',
        amount: 5000,
      };
      mockPrisma.transaction.findUnique.mockResolvedValue(existingTransaction);

      const result = await service.createTransaction(dto, currentUser);

      expect(result).toEqual(existingTransaction);
      // Le point le plus important : create ne doit JAMAIS etre appele dans ce cas
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
      expect(mockPrisma.client.findFirst).not.toHaveBeenCalled();
    });

    it("devrait rejeter une transaction pour un client d'une autre agence", async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'client-1',
        branchId: 'branch-DIFFERENTE',
      });

      await expect(service.createTransaction(dto, currentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('cancelTransaction', () => {
    it("devrait rejeter l'annulation d'une transaction deja annulee", async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        status: 'CANCELLED',
      });

      await expect(
        service.cancelTransaction(
          'txn-1',
          { reason: 'test' },
          { id: 'u1', role: 'Comptable', branchId: null },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    });

    it("devrait lever une exception si la transaction n'existe pas", async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelTransaction(
          'inconnu',
          { reason: 'test' },
          { id: 'u1', role: 'Comptable', branchId: null },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
