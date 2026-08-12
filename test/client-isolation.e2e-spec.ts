import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { setupApp } from '../src/setup-app';
import * as argon2 from 'argon2';

describe('Isolation clients entre agences (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let branchA: { id: string; code: string };
  let branchB: { id: string; code: string };
  let agentAToken: string;
  let clientInBranchB: { id: string };

  const suffix = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    branchA = await prisma.branch.create({
      data: { name: `Agence Test A ${suffix}`, code: `TSTA-${suffix}`, city: 'Lome' },
    });
    branchB = await prisma.branch.create({
      data: { name: `Agence Test B ${suffix}`, code: `TSTB-${suffix}`, city: 'Kara' },
    });

    const agentRole = await prisma.role.findFirst({ where: { name: 'Agent' } });
    const hashedPassword = await argon2.hash('MotDePasseTest123!');

    const agentA = await prisma.user.create({
      data: {
        email: `agent-a-${suffix}@autogo.tg`,
        password: hashedPassword,
        firstName: 'Agent',
        lastName: 'A',
        roleId: agentRole!.id,
        branchId: branchA.id,
      },
    });

    // Cree directement un client dans l'agence B via Prisma (pas besoin de passer par l'API pour ce setup)
    const seqResult = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('client_number_seq')`;
    clientInBranchB = await prisma.client.create({
      data: {
        clientNumber: `${branchB.code}-${String(seqResult[0].nextval).padStart(6, '0')}`,
        firstName: 'Client',
        lastName: 'DansAgenceB',
        phone: `+228${suffix}`,
        branchId: branchB.id,
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: agentA.email, password: 'MotDePasseTest123!' });

    agentAToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.client.deleteMany({ where: { id: clientInBranchB.id } });
    await prisma.user.deleteMany({ where: { email: { contains: `${suffix}@autogo.tg` } } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchA.id, branchB.id] } } });
    await app.close();
  });

  it('un Agent ne devrait PAS voir un client d\'une autre agence dans la liste', async () => {
    const response = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${agentAToken}`);

    expect(response.status).toBe(200);
    const ids = response.body.data.items.map((c: any) => c.id);
    expect(ids).not.toContain(clientInBranchB.id);
  });

  it('un Agent devrait recevoir 404 en consultant directement un client d\'une autre agence', async () => {
    const response = await request(app.getHttpServer())
      .get(`/clients/${clientInBranchB.id}`)
      .set('Authorization', `Bearer ${agentAToken}`);

    expect(response.status).toBe(404);
  });

  it('la recherche ne devrait pas retourner un client d\'une autre agence', async () => {
    const response = await request(app.getHttpServer())
      .get(`/clients/search?q=DansAgenceB`)
      .set('Authorization', `Bearer ${agentAToken}`);

    expect(response.status).toBe(200);
    const ids = response.body.data.map((c: any) => c.id);
    expect(ids).not.toContain(clientInBranchB.id);
  });
});