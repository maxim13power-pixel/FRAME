// backend/src/auth/email.service.ts
// ⭐ Переделано: использование Brevo HTTP API вместо SMTP
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private apiKey: string;
  private fromEmail: string;
  private fromName: string = 'FRAME';
  private brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor() {
    // Используем BREVO_API_KEY для HTTP API вместо SMTP
    this.apiKey = process.env.BREVO_API_KEY;
    this.fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@frame-app.ru';

    if (!this.apiKey) {
      this.logger.warn(
        '⚠️ Brevo API Key не настроен — письма отправляться не будут',
      );
      this.logger.warn(
        'Добавь в переменные окружения: BREVO_API_KEY',
      );
      return;
    }

    this.logger.log('✅ Brevo API инициализирован');
  }

  // ⭐ XSS-экранирование для безопасности
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
    if (!this.apiKey) {
      this.logger.warn(`[DEV MODE] Письмо для ${email}: ${resetLink}`);
      return true;
    }

    // ⭐ Экранируем ссылку для защиты от XSS
    const escapedLink = this.escapeHtml(resetLink);

    try {
      const payload = {
        sender: {
          name: this.fromName,
          email: this.fromEmail,
        },
        to: [
          {
            email: email,
          },
        ],
        subject: 'Восстановление пароля — FRAME',
        htmlContent: `
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
      };

      const response = await axios.post(this.brevoApiUrl, payload, {
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      this.logger.log(
        `✅ Письмо отправлено на ${email} (Message ID: ${response.data.messageId})`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Ошибка отправки письма на ${email}`,
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }
}

