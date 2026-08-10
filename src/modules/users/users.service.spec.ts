import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';

describe('UsersService - scoping par agence', () => {
  let service: UsersService;

  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('devrait filtrer par branchId pour un Manager', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.findAll({ id: 'user-1', role: 'Manager', branchId: 'branch-a' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, branchId: 'branch-a' },
        include: { role: true, branch: true },
      });
    });

    it('ne devrait PAS filtrer par branchId pour un SuperAdmin', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.findAll({ id: 'user-1', role: 'SuperAdmin', branchId: null });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        include: { role: true, branch: true },
      });
    });

    it('devrait lever une exception si un Manager n\'a pas d\'agence assignee', async () => {
      await expect(
        service.findAll({ id: 'user-1', role: 'Manager', branchId: null }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne - isolation entre agences', () => {
    it('devrait renvoyer 404 si l\'utilisateur cible appartient a une autre agence', async () => {
      // Simule Prisma qui ne trouve rien, car le where inclut branchId different
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('user-cible', { id: 'user-1', role: 'Manager', branchId: 'branch-a' }),
      ).rejects.toThrow(NotFoundException);

      // Verifie que le filtre d'agence a bien ete applique dans la requete
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-cible', deletedAt: null, branchId: 'branch-a' },
        include: { role: true, branch: true },
      });
    });
  });
});