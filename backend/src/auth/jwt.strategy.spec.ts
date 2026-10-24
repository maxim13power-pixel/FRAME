// backend/src/auth/jwt.strategy.spec.ts
// ⭐ №160: отзыв сессий через tokenVersion — «выйти на всех устройствах»
// и сброс пароля должны мгновенно инвалидировать ранее выданные JWT.
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy — версия сессий (№160)', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    strategy = new JwtStrategy(prisma as any);
  });

  it('пускает токен с актуальной версией сессии', async () => {
    prisma.user.findUnique.mockResolvedValue({ tokenVersion: 3 });

    await expect(
      strategy.validate({ sub: 7, tv: 3, role: 'FOREMAN', email: 'a@b.c' }),
    ).resolves.toMatchObject({ userId: 7, role: 'FOREMAN' });
  });

  it('отзывает токен после «выйти на всех устройствах»', async () => {
    prisma.user.findUnique.mockResolvedValue({ tokenVersion: 4 });

    await expect(strategy.validate({ sub: 7, tv: 3 })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('старые токены без tv считаются версией 0', async () => {
    prisma.user.findUnique.mockResolvedValue({ tokenVersion: 0 });

    await expect(strategy.validate({ sub: 7 })).resolves.toMatchObject({
      userId: 7,
    });
  });

  it('удалённый пользователь — 401', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 7, tv: 0 })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
