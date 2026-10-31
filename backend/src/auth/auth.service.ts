// backend/src/auth/auth.service.ts
import {
  HttpException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { CaptchaService } from '../captcha';
import { EmailService } from './email.service'; // ⭐ P0-4
import { ForgotPasswordDto } from './dto/forgot-password.dto'; // ⭐ P0-4
import { ResetPasswordDto } from './dto/reset-password.dto'; // ⭐ P0-4
import { RequestCodeDto } from './dto/request-code.dto'; // ⭐ №122b
import { VerifyEmailDto } from './dto/verify.dto'; // ⭐ №122b
import * as crypto from 'crypto'; // ⭐ P0-4
import { AccessRole, Unit } from '@prisma/client'; // ⭐ №127 онбординг

// ⭐ №210: код подтверждения израсходован (двойной клик/повторная отправка формы).
// Текст вынесен наружу — его проверяет спека регистрации.
export const EMAIL_CODE_ALREADY_USED =
  'Код уже использован — аккаунт создан. Войдите в систему или запросите новый код.';
@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prismaService: PrismaService,
    private captchaService: CaptchaService,
    private emailService: EmailService, // ⭐ P0-4
  ) {}

  async validateUser(login: string, pass: string): Promise<any> {
    // ⭐ Фича: принимаем и email и телефон (удобно для пользователей)
    const isEmail = login.includes('@');
    const user = await this.prismaService.user.findFirst({
      where: isEmail ? { email: login } : { phone: login },
    });
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, rememberMe: boolean = false) {
    // ⭐ Новая модель: в JWT только userId, email, phone, role (глобальная роль User).
    //    Доступ к объектам определяется через ObjectAccess (в object-access.guard.ts).
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      // ⭐ №160: версия сессий — сравнивается в jwt.strategy.ts.
      // Старые токены (без tv) считаются версией 0 и живут до истечения.
      tv: user.tokenVersion ?? 0,
    };
    // ⭐ №160: 15 дней по умолчанию, 180 — с «Запомнить меня».
    // (365 — после внедрения refresh-токенов.)
    const expiresIn = rememberMe ? '180d' : '15d';
    const access_token = this.jwtService.sign(payload, { expiresIn });

    return {
      access_token,
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  // ⭐ №160: «Выйти на всех устройствах» — инкремент tokenVersion делает
  // невалидными все ранее выданные JWT (включая текущий).
  async logoutAll(userId: number) {
    const user = await this.prismaService.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    });
    return {
      message: 'Все сессии завершены',
      tokenVersion: user.tokenVersion,
    };
  }

  // ⭐ Регистрация: email ИЛИ телефон + пароль + имя.
  // Возвращаем JWT сразу — пользователь попадает в приложение без повторного логина.
  async register(dto: RegisterDto, ip: string) {
    // 1. Валидация: верификация по email
    if (!dto.email) {
      throw new BadRequestException('Укажите email для регистрации');
    }

    // ⭐ Шаг 77: проверка капчи (в dev опциональна для удобства)
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && !dto.captchaToken) {
      throw new BadRequestException('Капча обязательна');
    }
    if (dto.captchaToken) {
      const isValid = await this.captchaService.validate(dto.captchaToken, ip);
      if (!isValid) {
        throw new BadRequestException('Капча не пройдена. Попробуйте ещё раз.');
      }
    }

    // 2. ⭐ №122b: НЕ создаём пользователя — проверяем занятость и отправляем код
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prismaService.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Этот email уже зарегистрирован');
    }

    const recent = await this.countRecentCodes(email);
    if (recent >= 3) {
      throw new HttpException('Слишком много запросов. Попробуйте через час.', 429);
    }

    const sent = await this.sendCode(email);
    return { message: 'Код отправлен на email', ...this.devCodePayload(sent) };
  }
  // ⭐ P0-4: Запрос восстановления пароля
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prismaService.user.findUnique({
      where: { email: dto.email },
    });

    // ⭐ Безопасность: ВСЕГДА возвращаем одинаковый ответ,
    // чтобы злоумышленник не мог узнать, зарегистрирован ли email в системе.
    const successMessage =
      'Если аккаунт с этим email существует, мы отправили ссылку для восстановления.';

    if (!user || !user.email) {
      return { message: successMessage };
    }

    // 1. Генерируем безопасный токен (64 hex символа = 256 бит энтропии)
    const plainToken = crypto.randomBytes(32).toString('hex');

    // 2. Аннулируем все предыдущие активные токены для этого юзера
    await this.prismaService.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // 3. Создаём новый токен (действителен 1 час)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prismaService.passwordResetToken.create({
      data: {
        token: plainToken,
        userId: user.id,
        expiresAt,
      },
    });

    // 4. Формируем ссылку и отправляем письмо
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    const resetLink = `${frontendUrl}/reset-password?token=${plainToken}`;

    await this.emailService.sendPasswordResetEmail(user.email, resetLink);

    return { message: successMessage };
  }

  // ⭐ P0-4: Сброс пароля по токену из письма
  async resetPassword(dto: ResetPasswordDto) {
    // Ищем активный и неистёкший токен
    const resetToken = await this.prismaService.passwordResetToken.findUnique({
      where: { token: dto.token },
    });

    const errorMessage = 'Неверная или истёкшая ссылка для восстановления.';

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException(errorMessage);
    }

    // Хэшируем новый пароль
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // Транзакция: обновляем пароль и помечаем токен как использованный
    await this.prismaService.$transaction([
      this.prismaService.user.update({
        where: { id: resetToken.userId },
        // ⭐ №160: сброс пароля заодно завершает все активные сессии
        data: { password: hashedPassword, tokenVersion: { increment: 1 } },
      }),
      this.prismaService.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Пароль успешно изменён. Теперь вы можете войти.' };
  }

  // ═══════ №122b: ВЕРИФИКАЦИЯ EMAIL ═══════

  private generateCode(): string {
    return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  }

  private async countRecentCodes(email: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.prismaService.verificationToken.count({
      where: { email, createdAt: { gte: oneHourAgo } },
    });
  }

  private async sendCode(
    email: string,
  ): Promise<{ code: string; emailSent: boolean }> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prismaService.verificationToken.create({
      data: { email, code, expiresAt },
    });
    await this.emailService.sendVerificationCode(email, code);
    return { code, emailSent: this.emailService.isConfigured() };
  }

  /** ⭐ №206: в dev без SMTP отдаём код в ответе, иначе зарегистрироваться нельзя */
  private devCodePayload(sent: { code: string; emailSent: boolean }) {
    const isProd = process.env.NODE_ENV === 'production';
    return !isProd && !sent.emailSent ? { devCode: sent.code } : {};
  }

  async requestCode(dto: RequestCodeDto) {
    const email = dto.email.trim().toLowerCase();
    const recent = await this.countRecentCodes(email);
    if (recent >= 3) {
      throw new HttpException('Слишком много запросов. Попробуйте через час.', 429);
    }
    const sent = await this.sendCode(email);
    return { message: 'Код отправлен на email', ...this.devCodePayload(sent) };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.trim().toLowerCase();
    // Rate limit: максимум 5 попыток в час на email
    const recent = await this.countRecentCodes(email);
    if (recent >= 5) {
      throw new HttpException('Слишком много попыток. Попробуйте через час.', 429);
    }

    const token = await this.prismaService.verificationToken.findFirst({
      where: {
        email,
        code: dto.code,
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!token) {
      // ⭐ №210: код уже израсходован (двойной клик / повторная отправка формы).
      // Раньше человек видел «Неверный или просроченный код» и считал, что
      // регистрация не сработала, хотя аккаунт уже создан.
      const usedToken = await this.prismaService.verificationToken.findFirst({
        where: { email, code: dto.code, used: true, expiresAt: { gte: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      if (usedToken) {
        throw new BadRequestException(EMAIL_CODE_ALREADY_USED);
      }
      throw new BadRequestException('Неверный или просроченный код');
    }

    await this.prismaService.verificationToken.update({
      where: { id: token.id },
      data: { used: true },
    });

    // ⭐ Создаём пользователя, если ещё нет
    let user = await this.prismaService.user.findUnique({ where: { email } });
    let isNew = false;
    if (!user) {
      const hashedPassword = await bcrypt.hash(
        dto.password || crypto.randomBytes(8).toString('hex'),
        10,
      );
      try {
        user = await this.prismaService.user.create({
          data: {
            email,
            password: hashedPassword,
            fullName: dto.fullName?.trim() || email.split('@')[0] || 'Пользователь',
            role: 'FOREMAN',
          },
        });
        isNew = true;
      } catch (e: any) {
        if (e.code === 'P2002') {
          user = await this.prismaService.user.findUnique({ where: { email } });
        } else {
          throw e;
        }
      }
    }

    if (!user) {
      throw new ConflictException('Не удалось создать пользователя');
    }

    // ⭐ №127: онбординг — новому пользователю создаём демо-объект со сметой.
    // Ошибка создания демо не должна блокировать регистрацию.
    if (isNew) {
      await this.createDemoObject(user.id).catch((err) => {
        console.warn('Онбординг: не удалось создать демо-объект', err);
      });
    }

    return this.login(user, false);
  }

  // ⭐ №127/№211: создаёт демо-объект «Квартира-образец» с 3 проектами (видами работ),
  // позициями, расценками ИЗ демо-справочника и частичным прогрессом — чтобы новый
  // прораб сразу видел, как FRAME выглядит на живом объекте, а не как пустой шаблон.
  private async createDemoObject(userId: number): Promise<void> {
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    // ⭐ №211: помощники для «живого» демо-объекта (даты фиксаций, деньги)
    const dayAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const r2 = (n: number) => Math.round(n * 100) / 100;

    // ⭐ 3 проекта демо-объекта: подготовка → черновые → чистовые
    const demoTemplate: {
      name: string;
      /** дни назад, за которые бригада фиксировала объёмы (для «Посменной сводки») */
      shifts: number[];
      materials: {
        name: string;
        unit: Unit;
        spec: number;
        used: number;
        /** расценка материала в демо-справочнике (та же единица измерения) */
        matItem?: string;
      }[];
    }[] = [
      {
        name: 'Демонтаж и подготовка',
        shifts: [11, 4],
        materials: [
          { name: 'Демонтаж старой отделки', unit: Unit.SQUARE_METER, spec: 68, used: 68 },
          { name: 'Грунтовка стен', unit: Unit.SQUARE_METER, spec: 180, used: 120 },
          { name: 'Демонтаж обоев', unit: Unit.SQUARE_METER, spec: 40, used: 0 },
        ],
      },
      {
        name: 'Черновые работы',
        shifts: [8, 3],
        materials: [
          { name: 'Заливка стяжки пола', unit: Unit.SQUARE_METER, spec: 68, used: 68 },
          { name: 'Шпаклёвка стен', unit: Unit.SQUARE_METER, spec: 120, used: 84 },
          {
            name: 'Прокладка кабеля в штробе',
            unit: Unit.METER,
            spec: 120,
            used: 60,
            matItem: 'Кабель ВВГнг-LS 3×1.5',
          },
          {
            name: 'Монтаж труб водоснабжения полипропилен',
            unit: Unit.METER,
            spec: 30,
            used: 12,
            matItem: 'Труба полипропилен PN20 25мм',
          },
        ],
      },
      {
        name: 'Чистовая отделка',
        shifts: [2],
        materials: [
          { name: 'Укладка ламината', unit: Unit.SQUARE_METER, spec: 68, used: 0 },
          { name: 'Укладка керамогранита', unit: Unit.SQUARE_METER, spec: 18, used: 18 },
          { name: 'Покраска стен', unit: Unit.SQUARE_METER, spec: 120, used: 24 },
          {
            // ⚠️ имя ровно как в демо-справочнике («встроенной», не «встроенная»)
            name: 'Установка розетки встроенной',
            unit: Unit.PIECE,
            spec: 24,
            used: 0,
            matItem: 'Розетка встроенная Legrand',
          },
        ],
      },
    ];

    // ⭐ №211: расценки берём из системного (демо) справочника — ownerId = null.
    // Благодаря этому объект привязан к справочнику, а позиции ссылаются на реальные
    // расценки (в модалке материала сразу видно, что выбрано, а не пустые поля).
    const demoCatalog = await this.prismaService.priceCatalog.findFirst({
      where: { ownerId: null },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        items: { select: { id: true, name: true, price: true, kind: true } },
      },
    });
    const normName = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();
    const workByName = new Map<string, { id: number; price: number }>();
    const matByName = new Map<string, { id: number; price: number }>();
    for (const item of demoCatalog?.items ?? []) {
      const entry = { id: item.id, price: Number(item.price) };
      if (item.kind === 'WORK') workByName.set(normName(item.name), entry);
      else matByName.set(normName(item.name), entry);
    }

    await this.prismaService.$transaction(async (tx) => {
      const object = await tx.object.create({
        data: {
          name: 'Квартира-образец, 68 м²',
          address: 'г. Москва, ул. Демонстрационная, д. 1, кв. 42',
          startDate: dayAgo(14),
          endDate: end,
          plannedEndDate: end,
          isDemo: true,
          // ⭐ №211: справочник цен объекта — иначе в смете нечего выбирать «из справочника»
          catalogId: demoCatalog?.id ?? null,
          note: 'Демо-объект для знакомства с FRAME. Можно удалить.',
          accesses: {
            create: { userId, role: AccessRole.CUSTOMER },
          },
        },
      });

      for (const p of demoTemplate) {
        const project = await tx.project.create({
          data: {
            name: p.name,
            startDate: dayAgo(14),
            endDate: end,
            objectId: object.id,
          },
        });
        for (const m of p.materials) {
          const work = workByName.get(normName(m.name));
          const mat = m.matItem ? matByName.get(normName(m.matItem)) : undefined;
          const used = Math.min(m.used, m.spec);
          const workPrice = work?.price ?? 0;
          const matPrice = mat?.price ?? 0;
          const shifts = p.shifts;
          const material = await tx.material.create({
            data: {
              name: m.name,
              unit: m.unit,
              specQuantity: m.spec,
              totalUsed: used,
              // ⭐ №211: прогресс = факт / план, а не нули у всех проектов
              progressPercent: m.spec > 0 ? Math.round((used / m.spec) * 1000) / 10 : 0,
              priceItemId: work?.id ?? null,
              unitPrice: workPrice,
              totalCost: r2(used * workPrice),
              materialItemId: mat?.id ?? null,
              materialUnitPrice: matPrice,
              materialTotalCost: r2(used * matPrice),
              lastEntry: used > 0 ? used : null,
              lastEntryDate: used > 0 ? dayAgo(shifts[shifts.length - 1] ?? 0) : null,
              projectId: project.id,
            },
          });
          // ⭐ №211: фиксации — иначе «Посменная сводка» и графики пустые.
          // Объём бьём на две смены, чтобы демо-объект выглядел как рабочая документация.
          if (used > 0) {
            const firstShift = Math.round(used * 0.6 * 1000) / 1000;
            const parts = [
              { amount: firstShift, days: shifts[0] ?? 0 },
              { amount: Math.round((used - firstShift) * 1000) / 1000, days: shifts[1] ?? 0 },
            ].filter((part) => part.amount > 0);
            for (const part of parts) {
              await tx.materialFix.create({
                data: {
                  materialId: material.id,
                  amount: part.amount,
                  fixedAt: dayAgo(part.days),
                  userId,
                },
              });
            }
          }
        }
      }
    });
  }
}
