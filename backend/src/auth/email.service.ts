// backend/src/auth/email.service.ts
// ⭐ P0-4: Сервис отправки писем по SMTP
// ⭐ №209: переезд Railway → Amvera — почта теперь Яндекс 360 (Brevo из РФ не работает).
//          Основные имена переменных: SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM.
//          Старые BREVO_* поддерживаются как алиас, чтобы не сломать уже настроенные стенды.
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly fromEmail: string;

  constructor() {
    // №209: сначала новые SMTP_*, затем устаревшие BREVO_*
    const host = process.env.SMTP_HOST || process.env.BREVO_SMTP_HOST;
    const port =
      Number(process.env.SMTP_PORT || process.env.BREVO_SMTP_PORT) || 587;
    const user = process.env.SMTP_USER || process.env.BREVO_SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.BREVO_SMTP_PASS;

    // Адрес отправителя: у Яндекса он должен совпадать с ящиком, под которым идёт SMTP-логин
    this.fromEmail =
      process.env.SMTP_FROM ||
      process.env.BREVO_FROM_EMAIL ||
      'noreply@frame.app';

    if (!host || !user || !pass) {
      this.logger.warn(
        '⚠️ SMTP не настроен — письма отправляться не будут',
      );
      this.logger.warn(
        'Добавь в env: SMTP_HOST, SMTP_USER, SMTP_PASS (и SMTP_PORT/SMTP_FROM при необходимости)',
      );
      this.transporter = null as any;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  // ⭐ №206: настроен ли SMTP — нужно, чтобы в dev показать код подтверждения
  isConfigured(): boolean {
    return !!this.transporter;
  }

  // ⭐ HOTFIX: XSS-экранирование для безопасности
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async sendPasswordResetEmail(
    email: string,
    resetLink: string,
  ): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`[DEV MODE] Письмо для ${email}: ${resetLink}`);
      return true;
    }

    // ⭐ Экранируем ссылку для защиты от XSS
    const escapedLink = this.escapeHtml(resetLink);

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Восстановление пароля — FRAME',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Восстановление пароля</h2>
          <p>Вы запросили сброс пароля для аккаунта FRAME.</p>
          <p>Нажмите на ссылку ниже, чтобы установить новый пароль:</p>
          <a href="${escapedLink}" style="display: inline-block; padding: 12px 24px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
            Сбросить пароль
          </a>
          <p style="color: #666; font-size: 14px;">Ссылка действительна 1 час.</p>
          <p style="color: #999; font-size: 12px;">Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
        </div>
      `,
      });
      this.logger.log(`✅ Письмо отправлено на ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Ошибка отправки письма на ${email}`, error);
      return false;
    }
  }

  // ⭐ №122b: отправка 6-значного кода верификации email
  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`[DEV MODE] Код верификации для ${email}: ${code}`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'Код подтверждения — FRAME',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Подтверждение email</h2>
          <p>Ваш код подтверждения:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1976d2; margin: 16px 0;">
            ${this.escapeHtml(code)}
          </p>
          <p style="color: #666; font-size: 14px;">Код действителен 15 минут.</p>
          <p style="color: #999; font-size: 12px;">Если вы не регистрировались в FRAME, проигнорируйте это письмо.</p>
        </div>
      `,
      });
      this.logger.log(`✅ Код верификации отправлен на ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Ошибка отправки кода на ${email}`, error);
      return false;
    }
  }
}
