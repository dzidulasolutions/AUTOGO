import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TontinesService } from './tontines.service';
import { PrismaService } from '../../database/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';

describe('TontinesService', () => {
  let service: TontinesService;

  const mockPrisma = {
    tontineCycle: { findFirst: jest.fn(), update: jest.fn() },
    tontineCollection: { aggregate: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockTransactionsService = { createTransaction: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TontinesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TransactionsService, useValue: mockTransactionsService },
      ],
    }).compile();

    service = module.get<TontinesService>(TontinesService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
  });

  describe('closeCycle - calcul de restitution', () => {
    const currentUser = { id: 'agent-1', role: 'SuperAdmin', branchId: null };

    it('devrait calculer correctement la restitution avec commission', async () => {
      mockPrisma.tontineCycle.findFirst.mockResolvedValue({
        id: 'cycle-1',
        cycleNumber: 'TON-000001',
        amountPerCollection: 500,
        commissionRate: 0.05,
        clientId: 'client-1',
        client: { branchId: 'branch-a', assignedAgentId: null },
      });
      // 10 echeances collectees sur ce cycle
      mockPrisma.tontineCollection.aggregate.mockResolvedValue({ _count: { id: 10 } });
      mockTransactionsService.createTransaction.mockResolvedValue({ id: 'txn-1' });

      const result = await service.closeCycle('cycle-1', { idempotencyKey: 'k1' }, currentUser);

      // 10 x 500 = 5000 collecte, commission 5% = 250, restitution = 4750
      expect(result.totalCollected).toBe(5000);
      expect(result.commission).toBe(250);
      expect(result.restitutionAmount).toBe(4750);
    });

    it('devrait rejeter la cloture si rien n\'a ete collecte', async () => {
      mockPrisma.tontineCycle.findFirst.mockResolvedValue({
        id: 'cycle-1',
        amountPerCollection: 500,
        commissionRate: 0.05,
        clientId: 'client-1',
        client: { branchId: 'branch-a', assignedAgentId: null },
      });
      mockPrisma.tontineCollection.aggregate.mockResolvedValue({ _count: { id: 0 } });

      await expect(
        service.closeCycle('cycle-1', { idempotencyKey: 'k2' }, currentUser),
      ).rejects.toThrow(BadRequestException);

      expect(mockTransactionsService.createTransaction).not.toHaveBeenCalled();
    });
  });

  describe('validateCollection - rattrapage', () => {
    const currentUser = { id: 'agent-1', role: 'SuperAdmin', branchId: null };

    it('devrait rejeter la validation d\'une echeance deja collectee', async () => {
      mockPrisma.tontineCollection.findFirst.mockResolvedValue({
        id: 'col-1',
        status: 'COLLECTE',
        cycle: { client: { branchId: 'branch-a', assignedAgentId: null } },
      });

      await expect(
        service.validateCollection('col-1', { idempotencyKey: 'k3' }, currentUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait accepter la validation d\'une echeance MANQUE (rattrapage)', async () => {
      mockPrisma.tontineCollection.findFirst.mockResolvedValue({
        id: 'col-1',
        status: 'MANQUE', // rattrapage, pas un jour normal
        scheduledDate: new Date('2026-08-01'),
        cycle: {
          cycleNumber: 'TON-000001',
          amountPerCollection: 500,
          clientId: 'client-1',
          client: { branchId: 'branch-a', assignedAgentId: null },
        },
      });
      mockTransactionsService.createTransaction.mockResolvedValue({ id: 'txn-1' });
      mockPrisma.tontineCollection.update.mockResolvedValue({ status: 'COLLECTE' });

      const result = await service.validateCollection('col-1', { idempotencyKey: 'k4' }, currentUser);

      expect(result.collection.status).toBe('COLLECTE');
      // Confirme que le meme montant est utilise, pas de penalite ajoutee
      expect(mockTransactionsService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 500 }),
        expect.anything(),
        expect.anything(),
      );
    });
  });
});