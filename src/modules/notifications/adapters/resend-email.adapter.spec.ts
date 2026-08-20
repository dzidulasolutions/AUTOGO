import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ResendEmailAdapter } from './resend-email.adapter';

// On simule le module resend entier, pour controler precisement son comportement
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn() },
  })),
}));

describe('ResendEmailAdapter', () => {
  let adapter: ResendEmailAdapter;
  let mockSend: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResendEmailAdapter,
        { provide: ConfigService, useValue: { get: () => 'fake-api-key' } },
      ],
    }).compile();

    adapter = module.get<ResendEmailAdapter>(ResendEmailAdapter);
    mockSend = (adapter as any).resend.emails.send;
  });

  it('ne devrait jamais lever d\'exception, meme si l\'envoi echoue', async () => {
    mockSend.mockResolvedValue({ error: { message: 'Erreur simulee Resend' } });

    // Le point cle : cet appel ne doit JAMAIS rejeter, peu importe l'erreur interne
    await expect(
      adapter.send('test@example.com', 'Sujet', '<p>Contenu</p>'),
    ).resolves.not.toThrow();
  });

  it('ne devrait pas planter si Resend lance une exception reseau', async () => {
    mockSend.mockRejectedValue(new Error('Network timeout'));

    await expect(
      adapter.send('test@example.com', 'Sujet', '<p>Contenu</p>'),
    ).resolves.not.toThrow();
  });
});