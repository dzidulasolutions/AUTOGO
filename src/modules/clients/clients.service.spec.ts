import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { PrismaService } from '../../database/prisma.service';

describe('ClientsService', () => {
  let service: ClientsService;

  const mockPrisma = {
    client: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    branch: {
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClientsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const currentUser = { id: 'agent-1', role: 'Agent', branchId: 'branch-a' };
    const dto = { firstName: 'Ama', lastName: 'Koudjo', phone: '+22890000000' };

    it('devrait generer un clientNumber correctement formate', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null); // pas de doublon telephone
      mockPrisma.branch.findFirst.mockResolvedValue({ id: 'branch-a', code: 'LOM-01' });
      mockPrisma.$queryRaw.mockResolvedValue([{ nextval: BigInt(42) }]);
      mockPrisma.client.create.mockImplementation(({ data }) => Promise.resolve(data));

      const result = await service.create(dto, currentUser);

      expect(result.clientNumber).toBe('LOM-01-000042');
    });

    it('devrait rejeter la creation si le telephone existe deja', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({ id: 'existing-client' });

      await expect(service.create(dto, currentUser)).rejects.toThrow(ConflictException);

      // La sequence ne doit JAMAIS etre appelee si le telephone est deja pris
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('findAll - isolation agence', () => {
    it('devrait lever une exception si un role non privilegie n\'a pas d\'agence', async () => {
      await expect(
        service.findAll({ id: 'u1', role: 'Agent', branchId: null }, { page: 1, limit: 20 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});