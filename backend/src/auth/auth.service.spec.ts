// backend/src/auth/auth.service.spec.ts
// ⭐ №210: первые реальные тесты AuthService — подтверждение email (verify).
// Раньше здесь стоял `it.todo`, из-за чего рассинхрон «код израсходован, а
// клиент остался на форме» не ловился ни одним тестом.
import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// ⭐ №210: auth.service импортирует баррель капчи, а тот тянет @nestjs/axios (ESM) —
// jest его не парсит. Сетевой сервис в юнит-тестах не нужен, мокаем баррель.
jest.mock('../captcha', () => ({ CaptchaService: class CaptchaService {} }));

import { AuthService, EMAIL_CODE_ALREADY_USED } from './auth.service';

const makeService = () => {
  const prisma = {
    verificationToken: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    // Онбординг (демо-объект) выполняется в транзакции — отдаём простую заглушку.
    $transaction: jest.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        object: { create: jest.fn().mockResolvedValue({ id: 10 }) },
        project: { create: jest.fn().mockResolvedValue({ id: 20 }) },
        material: { create: jest.fn().mockResolvedValue({ id: 30 }) },
        materialFix: { create: jest.fn().mockResolvedValue({ id: 40 }) },
      }),
    ),
    // ⭐ №211: демо-объект ищет системный справочник цен
    priceCatalog: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const jwt = { sign: jest.fn().mockReturnValue('jwt.token') };
  const captcha = { validate: jest.fn().mockResolvedValue(true) };
  const email = {
    isConfigured: jest.fn().mockReturnValue(false),
    sendVerificationCode: jest.fn().mockResolvedValue(undefined),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new AuthService(jwt as any, prisma as any, captcha as any, email as any);
  return { service, prisma, jwt, captcha, email };
};

const newUser = {
  id: 5,
  email: 'marina@frame-app.test',
  fullName: 'Марина',
  phone: null,
  role: 'FOREMAN',
  tokenVersion: 0,
};

describe('AuthService.verifyEmail', () => {
  it('верный код: помечает код использованным, создаёт юзера и отдаёт JWT', async () => {
    const { service, prisma, jwt } = makeService();
    prisma.verificationToken.findFirst.mockResolvedValue({ id: 7, code: '148084' });
    prisma.user.create.mockResolvedValue(newUser);

    const result = await service.verifyEmail({
      email: 'Marina@Frame-App.Test',
      code: '148084',
      fullName: 'Марина',
      password: 'secret123',
    });

    expect(prisma.verificationToken.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { used: true },
    });
    // email нормализуется в нижний регистр — иначе токен не найдётся
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'marina@frame-app.test', role: 'FOREMAN' }),
    });
    expect(jwt.sign).toHaveBeenCalled();
    expect(result).toEqual({
      access_token: 'jwt.token',
      user: expect.objectContaining({ id: 5, email: 'marina@frame-app.test' }),
    });
  });

  it('код уже израсходован (двойной клик): понятная ошибка, юзер не создаётся', async () => {
    const { service, prisma } = makeService();
    prisma.verificationToken.findFirst
      .mockResolvedValueOnce(null) // активного кода нет
      .mockResolvedValueOnce({ id: 7, code: '148084' }); // но такой код был использован

    await expect(
      service.verifyEmail({ email: 'marina@frame-app.test', code: '148084' }),
    ).rejects.toThrow(EMAIL_CODE_ALREADY_USED);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});


describe('AuthService.verifyEmail (продолжение)', () => {
  it('неизвестный код: «Неверный или просроченный код»', async () => {
    const { service, prisma } = makeService();
    prisma.verificationToken.findFirst.mockResolvedValue(null);

    await expect(
      service.verifyEmail({ email: 'marina@frame-app.test', code: '000000' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.verifyEmail({ email: 'marina@frame-app.test', code: '000000' }),
    ).rejects.toThrow('Неверный или просроченный код');
  });

  it('лимит попыток: 5 запросов за час → 429 (а не 400)', async () => {
    const { service, prisma } = makeService();
    prisma.verificationToken.count.mockResolvedValue(5);

    await expect(
      service.verifyEmail({ email: 'marina@frame-app.test', code: '148084' }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('юзер уже существует: второго не создаёт, просто пускает внутрь', async () => {
    const { service, prisma } = makeService();
    prisma.verificationToken.findFirst.mockResolvedValue({ id: 8, code: '148084' });
    prisma.user.findUnique.mockResolvedValue(newUser);

    const result = await service.verifyEmail({
      email: 'marina@frame-app.test',
      code: '148084',
    });

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled(); // демо-объект не пересоздаётся
    expect(result.access_token).toBe('jwt.token');
  });
});

describe('AuthService.changePassword (№215)', () => {
  const OLD = 'old-pass1';
  const hash = bcrypt.hashSync(OLD, 4); // 4 раунда — тесты быстрее

  it('неверный текущий пароль → 400, пароль не меняется', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ ...newUser, password: hash });

    await expect(
      service.changePassword(5, { currentPassword: 'wrong-pass1', newPassword: 'Marina2026' }),
    ).rejects.toThrow('Текущий пароль указан неверно');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('слабый новый пароль → 400 с текстом политики', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ ...newUser, password: hash });

    await expect(
      service.changePassword(5, { currentPassword: OLD, newPassword: '123456' }),
    ).rejects.toThrow(/8 символов/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('новый пароль совпадает с текущим → 400', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ ...newUser, password: hash });

    await expect(
      service.changePassword(5, { currentPassword: OLD, newPassword: OLD }),
    ).rejects.toThrow(/совпадает с текущим/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('успех: пароль перехэширован, tokenVersion +1, вернулся свежий токен', async () => {
    const { service, prisma, jwt } = makeService();
    prisma.user.findUnique.mockResolvedValue({ ...newUser, password: hash });
    prisma.user.update.mockResolvedValue({ ...newUser, tokenVersion: 1 });

    const result = await service.changePassword(5, {
      currentPassword: OLD,
      newPassword: 'Marina2026',
    });

    const updateArgs = prisma.user.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 5 });
    expect(updateArgs.data.tokenVersion).toEqual({ increment: 1 });
    expect(updateArgs.data.password).not.toBe('Marina2026'); // хэш, не открытый текст
    expect(jwt.sign).toHaveBeenCalled();
    expect(result.access_token).toBe('jwt.token');
    expect(result.message).toMatch(/Пароль изменён/);
  });
});

describe('AuthService.register', () => {
  it('в dev без SMTP отдаёт devCode и создаёт токен', async () => {
    const { service, prisma, email } = makeService();

    const result = await service.register(
      { email: ' Marina@Frame-App.Test ', fullName: 'Марина', password: 'secret123' } as never,
      '127.0.0.1',
    );

    expect(prisma.verificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'marina@frame-app.test' }),
    });
    expect(email.sendVerificationCode).toHaveBeenCalled();
    expect(result.devCode).toMatch(/^\d{6}$/);
  });

  it('занятый email → 409 «уже зарегистрирован»', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(newUser);

    await expect(
      service.register(
        { email: 'marina@frame-app.test', fullName: 'Марина', password: 'secret123' } as never,
        '127.0.0.1',
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.verificationToken.create).not.toHaveBeenCalled();
  });

  it('больше 3 запросов кода за час → 429', async () => {
    const { service, prisma } = makeService();
    prisma.verificationToken.count.mockResolvedValue(3);

    await expect(
      service.register(
        { email: 'marina@frame-app.test', fullName: 'Марина', password: 'secret123' } as never,
        '127.0.0.1',
      ),
    ).rejects.toThrow(HttpException);
  });
});

