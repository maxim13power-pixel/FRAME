// backend/src/auth/email.service.ts
// ⭐ P0-4: Сервис отправки писем через Brevo SMTP
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    const host = process.env.BREVO_SMTP_HOST;
    const port = Number(process.env.BREVO_SMTP_PORT) || 587;
    const user = process.env.BREVO_SMTP_USER;
    const pass = process.env.BREVO_SMTP_PASS;

    if (!host || !user || !pass) {
      this.logger.warn('⚠️ Brevo SMTP не настроен — письма отправляться не будут');
      this.logger.warn('Добавь в backend/.env: BREVO_SMTP_HOST, BREVO_SMTP_USER, BREVO_SMTP_PASS');
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

  async sendPasswordResetEmail(email: string, resetLink: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`[DEV MODE] Письмо для ${email}: ${resetLink}`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.BREVO_FROM_EMAIL || 'noreply@frame.app',
        to: email,
        subject: 'Восстановление пароля — FRAME',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1976d2;">Восстановление пароля</h2>
            <p>Вы запросили сброс пароля для аккаунта FRAME.</p>
            <p>Нажмите на ссылку ниже, чтобы установить новый пароль:</p>
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">
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
}