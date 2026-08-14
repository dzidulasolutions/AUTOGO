import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { SavingsService } from '../src/modules/savings/savings.service';
import { PrismaService } from '../src/database/prisma.service';
import { setupApp } from '../src/setup-app';
import { randomUUID } from 'crypto';

describe('Savings - concurrence sur retrait (e2e)', () => {
  let app: INestApplication;
  let savingsService: SavingsService;
  let prisma: PrismaService;
  let accountId: string;
  let clientId: string;
  const currentUser = { id: '', role: 'SuperAdmin', branchId: null };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    savingsService = moduleFixture.get(SavingsService);
    prisma = moduleFixture.get(PrismaService);

    const branch = await prisma.branch.findFirst();
    const client = await prisma.client.create({
      data: {
        clientNumber: `TEST-${Date.now()}`,
        firstName: 'Test',
        lastName: 'Concurrence',
        phone: `+228${Date.now()}`,
        branchId: branch!.id,
      },
    });
    clientId = client.id;

    const admin = await prisma.user.findFirst({
      where: { role: { name: 'SuperAdmin' } },
    });
    currentUser.id = admin!.id;

    const account = await savingsService.openAccount({ clientId }, currentUser);
    accountId = (account as any).id;

    await savingsService.deposit(
      accountId,
      { amount: 10000, idempotencyKey: randomUUID() },
      currentUser,
    );
  });

  afterAll(async () => {
    // Soft delete uniquement : les transactions rattachees empechent (a raison) toute suppression physique du client
    await prisma.client.update({
      where: { id: clientId },
      data: { deletedAt: new Date() },
    });
    await app.close();
  });

  it('devrait refuser un des deux retraits simultanes si un seul peut etre couvert par le solde', async () => {
    const results = await Promise.allSettled([
      savingsService.withdraw(
        accountId,
        { amount: 8000, idempotencyKey: randomUUID() },
        currentUser,
      ),
      savingsService.withdraw(
        accountId,
        { amount: 8000, idempotencyKey: randomUUID() },
        currentUser,
      ),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(1);

    const finalAccount = await prisma.savingsAccount.findUnique({
      where: { id: accountId },
    });
    expect(Number(finalAccount!.balance)).toBe(2000);
  });
});
