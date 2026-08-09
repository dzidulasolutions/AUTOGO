import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { setupApp } from '../src/setup-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: `test-e2e-${Date.now()}@autogo.tg`, // email unique a chaque run, evite les conflits
    password: 'MotDePasseTest123!',
    firstName: 'Test',
    lastName: 'E2E',
  };

  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app); // exactement la meme config que main.ts, plus de duplication ni de divergence possible
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Nettoyage : supprime l'utilisateur de test cree pendant ce run
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await app.close();
  });

  it('devrait creer un utilisateur (via un role existant)', async () => {
    const role = await prisma.role.findFirst({ where: { name: 'Agent' } });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${await getSuperAdminToken()}`)
      .send({ ...testUser, roleId: role!.id });

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe(testUser.email);
    expect(response.body.data.password).toBeUndefined(); // le mot de passe ne doit jamais fuiter
  });

  it('devrait refuser la connexion avec un mauvais mot de passe', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: 'mauvais-mot-de-passe' });

    expect(response.status).toBe(401);
  });

  it("devrait connecter l'utilisateur avec les bons identifiants", async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeDefined();
    expect(response.body.data.refreshToken).toBeDefined();

    accessToken = response.body.data.accessToken;
    refreshToken = response.body.data.refreshToken;
  });

  it("devrait refuser l'acces a une route protegee sans token", async () => {
    const response = await request(app.getHttpServer()).get('/users/me');
    expect(response.status).toBe(401);
  });

  it("devrait autoriser l'acces a une route protegee avec un token valide", async () => {
    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(testUser.email);
  });

  it("devrait rafraichir les tokens et invalider l'ancien refresh token", async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeDefined();

    // Reutiliser l'ANCIEN refresh token doit maintenant echouer
    const reuseAttempt = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(reuseAttempt.status).toBe(401);
  });

  // Fonction utilitaire pour recuperer un token admin, necessaire pour creer un user
  async function getSuperAdminToken(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD,
      });
    return response.body.data.accessToken;
  }
});
