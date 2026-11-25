// backend/src/auth/email.service.spec.ts
// ⭐ №399: тестовые адреса *@local.test не должны уходить в реальный SMTP.
// Регрессия создаёт десятки пользователей @local.test — без этой защиты мы бы бомбили SMTP
// письмами на несуществующие домены (отказы, лимиты провайдера).
import { EmailService, isTestRecipient } from './email.service';

describe('isTestRecipient', () => {
  it('ловит адреса *@local.test в любом регистре и с пробелами', () => {
    expect(isTestRecipient('user@local.test')).toBe(true);
    expect(isTestRecipient('  USER@LOCAL.TEST ')).toBe(true);
    expect(isTestRecipient('user@sub.local.test')).toBe(false);
  });

  it('обычные адреса не считает тестовыми', () => {
    expect(isTestRecipient('support@frame-app.ru')).toBe(false);
    expect(isTestRecipient('someone@example.com')).toBe(false);
    expect(isTestRecipient('')).toBe(false);
    expect(isTestRecipient(null)).toBe(false);
    expect(isTestRecipient(undefined)).toBe(false);
  });
});

describe('EmailService — защита тестовых адресов', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('с настроенным SMTP письмо на @local.test не отправляется, но считается успешным', async () => {
    // Настраиваем «как на проде», чтобы transporter создался, и подменяем sendMail,
    // чтобы поймать попытку реальной отправки.
    process.env = {
      ...originalEnv,
      SMTP_HOST: 'smtp.example',
      SMTP_PORT: '465',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    };
    const service = new EmailService();
    expect(service.isConfigured()).toBe(true);

    const transporter = (service as any).transporter;
    transporter.sendMail = jest.fn();

    await expect(
      service.sendVerificationCode('user@local.test', '123456'),
    ).resolves.toBe(true);
    await expect(
      service.sendAlertEmail('user@local.test', 'тест', 'текст'),
    ).resolves.toBe(true);
    expect(transporter.sendMail).not.toHaveBeenCalled();

    // А настоящий адрес — отправляется (сервис живой, защита не блокирует всё подряд).
    transporter.sendMail.mockResolvedValue({ messageId: 'x' });
    await service.sendVerificationCode('support@frame-app.ru', '123456');
    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
  });
});
