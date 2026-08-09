import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { MockNotificationAdapter } from './adapters/mock-notification.adapter';
import * as argon2 from 'argon2';

// On remplace le vrai module argon2 par une version controlee pour les tests
jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  // Un faux PrismaService : chaque methode utilisee par AuthService devient une fonction simulee
  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('fake-access-token'),
  };

  const mockNotificationAdapter = {
    sendVerificationCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MockNotificationAdapter, useValue: mockNotificationAdapter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks(); // reinitialise les mocks entre chaque test, evite qu'un test pollue le suivant
  });

  describe('validateUser', () => {
    it("devrait retourner l'utilisateur si email et mot de passe sont corrects", async () => {
      const fakeUser = {
        id: 'user-1',
        email: 'test@autogo.tg',
        password: 'hashed-password',
        deletedAt: null,
        role: { name: 'Agent' },
      };
      mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@autogo.tg',
        'password123',
      );

      expect(result).toEqual(fakeUser);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@autogo.tg', deletedAt: null },
        include: { role: true },
      });
    });

    it("devrait lever une exception si l'utilisateur n'existe pas", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.validateUser('inconnu@autogo.tg', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('devrait lever une exception si le mot de passe est incorrect', async () => {
      const fakeUser = {
        id: 'user-1',
        email: 'test@autogo.tg',
        password: 'hashed-password',
        deletedAt: null,
        role: { name: 'Agent' },
      };
      mockPrisma.user.findFirst.mockResolvedValue(fakeUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser('test@autogo.tg', 'mauvais-mot-de-passe'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh - detection de reutilisation', () => {
    it('devrait revoquer toute la famille de tokens si un token deja revoque est reutilise', async () => {
      const revokedToken = {
        id: 'token-1',
        familyId: 'family-abc',
        revoked: true, // deja utilise une fois
        expiresAt: new Date(Date.now() + 100000),
        user: {
          id: 'user-1',
          email: 'test@autogo.tg',
          role: { name: 'Agent' },
        },
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(revokedToken);

      await expect(service.refresh('un-token-quelconque', {})).rejects.toThrow(
        UnauthorizedException,
      );

      // Le point le plus important a verifier : TOUTE la famille a ete revoquee, pas juste ce token
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-abc' },
        data: { revoked: true },
      });
    });
  });
});
