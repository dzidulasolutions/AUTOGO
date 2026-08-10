import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { setupApp } from '../src/setup-app';
import * as argon2 from 'argon2';

describe('Isolation entre agences (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let branchA: { id: string };
  let branchB: { id: string };
  let managerAToken: string;
  let userInBranchB: { id: string };

  const suffix = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Prepare deux agences et un role Manager pour le scenario
    branchA = await prisma.branch.create({
      data: {
        name: `Agence Test A ${suffix}`,
        code: `TSTA-${suffix}`,
        city: 'Lome',
      },
    });
    branchB = await prisma.branch.create({
      data: {
        name: `Agence Test B ${suffix}`,
        code: `TSTB-${suffix}`,
        city: 'Kara',
      },
    });

    const managerRole = await prisma.role.findFirst({
      where: { name: 'Manager' },
    });

    const hashedPassword = await argon2.hash('MotDePasseTest123!');

    const managerA = await prisma.user.create({
      data: {
        email: `manager-a-${suffix}@autogo.tg`,
        password: hashedPassword,
        firstName: 'Manager',
        lastName: 'A',
        roleId: managerRole!.id,
        branchId: branchA.id,
      },
    });

    userInBranchB = await prisma.user.create({
      data: {
        email: `user-b-${suffix}@autogo.tg`,
        password: hashedPassword,
        firstName: 'User',
        lastName: 'B',
        roleId: managerRole!.id,
        branchId: branchB.id,
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: managerA.email, password: 'MotDePasseTest123!' });

    managerAToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: `${suffix}@autogo.tg` } },
    });
    await prisma.branch.deleteMany({
      where: { id: { in: [branchA.id, branchB.id] } },
    });
    await app.close();
  });

  it("un Manager ne devrait PAS voir les utilisateurs d'une autre agence dans la liste", async () => {
    const response = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${managerAToken}`);

    expect(response.status).toBe(200);
    const ids = response.body.data.map((u: any) => u.id);
    expect(ids).not.toContain(userInBranchB.id);
  });

  it("un Manager devrait recevoir 404 en consultant directement un utilisateur d'une autre agence", async () => {
    const response = await request(app.getHttpServer())
      .get(`/users/${userInBranchB.id}`)
      .set('Authorization', `Bearer ${managerAToken}`);

    expect(response.status).toBe(404);
  });
});
