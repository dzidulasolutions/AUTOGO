import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from './cache.service';

describe('DashboardService - cache', () => {
  let service: DashboardService;
  const mockCache = { get: jest.fn(), set: jest.fn() };
  const mockPrisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
        { provide: 'BullQueue_reports', useValue: {} },
      ],
    }).compile();
    service = module.get(DashboardService);
    jest.clearAllMocks();
  });

  it('devrait retourner la valeur en cache sans interroger la base', async () => {
    mockCache.get.mockResolvedValue([{ cached: true }]);

    const result = await service.getPortfolioAtRisk({
      id: 'u1',
      role: 'SuperAdmin',
      branchId: null,
    });

    expect(result).toEqual([{ cached: true }]);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('devrait interroger la base et mettre en cache si rien en cache', async () => {
    mockCache.get.mockResolvedValue(null);
    mockPrisma.$queryRaw.mockResolvedValue([{ fresh: true }]);

    const result = await service.getPortfolioAtRisk({
      id: 'u1',
      role: 'SuperAdmin',
      branchId: null,
    });

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockCache.set).toHaveBeenCalledWith(
      'dashboard:portfolio-risk:all',
      [{ fresh: true }],
      300,
    );
  });
});
