import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LoansService } from './loans.service';
import { PrismaService } from '../../database/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { ResendEmailAdapter } from '../notifications/adapters/resend-email.adapter';
import { SettingsService } from '../settings/settings.service';

describe('LoansService', () => {
  let service: LoansService;

  const mockPrisma = {
    loan: { findFirst: jest.fn(), update: jest.fn() },
    loanSchedule: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockTransactionsService = { createTransaction: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TransactionsService, useValue: mockTransactionsService },
        { provide: SettingsService, useValue: { get: jest.fn().mockResolvedValue(0.1) },},
        { provide: ResendEmailAdapter, useValue: { send: jest.fn() } },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback) =>
      callback(mockPrisma),
    );
  });

  describe('generateInstallmentAmounts - amortissement lineaire', () => {
    it('devrait repartir le total en montants ronds, la derniere echeance absorbant le reste', () => {
      // Acces a une methode privee via cast pour le test - cas courant et acceptable pour tester un calcul pur
      const amounts = (service as any).generateInstallmentAmounts(770000, 420);

      // Chaque montant (sauf le dernier) doit etre un multiple de 50
      const regularAmounts = amounts.slice(0, -1);
      regularAmounts.forEach((amount: number) => {
        expect(amount % 50).toBe(0);
      });

      // La somme totale doit correspondre exactement au montant du, jamais d'ecart
      const total = amounts.reduce((sum: number, a: number) => sum + a, 0);
      expect(total).toBeCloseTo(770000, 2);
    });
  });

  describe('recordRepayment - imputation FIFO', () => {
    const currentUser = { id: 'agent-1', role: 'Agent', branchId: 'branch-a' };

    it("devrait rejeter un montant qui ne correspond pas a un nombre entier d'echeances", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          loan: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'loan-1',
              clientId: 'client-1',
              loanNumber: 'LOAN-000001',
              client: { branchId: 'branch-a', assignedAgentId: 'agent-1' },
            }),
          },
          loanSchedule: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 's1',
                installmentNumber: 1,
                amountDue: 1800,
                status: 'PENDING',
              },
              {
                id: 's2',
                installmentNumber: 2,
                amountDue: 1800,
                status: 'PENDING',
              },
            ]),
          },
        };
        return callback(tx);
      });

      // 2000 ne correspond ni a 1 echeance (1800) ni a 2 (3600)
      await expect(
        service.recordRepayment(
          'loan-1',
          { amount: 2000, idempotencyKey: 'k1' },
          currentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait accepter un montant couvrant exactement 2 echeances consecutives', async () => {
      const mockUpdate = jest.fn();
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          loan: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'loan-1',
              clientId: 'client-1',
              loanNumber: 'LOAN-000001',
              client: { branchId: 'branch-a', assignedAgentId: 'agent-1' },
            }),
            update: jest.fn(),
          },
          loanSchedule: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 's1',
                installmentNumber: 1,
                amountDue: 1800,
                status: 'PENDING',
              },
              {
                id: 's2',
                installmentNumber: 2,
                amountDue: 1800,
                status: 'PENDING',
              },
              {
                id: 's3',
                installmentNumber: 3,
                amountDue: 1800,
                status: 'PENDING',
              },
            ]),
            update: mockUpdate,
            count: jest.fn().mockResolvedValue(1), // il reste 1 echeance impayee apres (s3)
          },
        };
        return callback(tx);
      });
      mockTransactionsService.createTransaction.mockResolvedValue({
        id: 'txn-1',
      });

      const result = await service.recordRepayment(
        'loan-1',
        { amount: 3600, idempotencyKey: 'k2' },
        currentUser,
      );

      expect(result.schedulesPaid).toBe(2);
      expect(mockUpdate).toHaveBeenCalledTimes(2); // exactement s1 et s2, pas s3
      expect(result.loanClosed).toBe(false); // il reste encore s3
    });
  });
});
