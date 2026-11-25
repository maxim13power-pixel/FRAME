// backend/src/common/alerts/telegram-alerts.service.ts
// ⭐ №396: алерты об ошибках — Telegram (основной канал) + e-mail (резерв).
//
// Почему резерв: из некоторых сетей (в т.ч. офисных/домашних в РФ) api.telegram.org не
// резолвится вовсе. Тогда алерт не должен теряться — уходит письмом (SMTP уже настроен для
// писем авторизации), а причина пишется в лог.
//
// Принципы:
//   • без каналов (нет токена и нет ALERT_EMAIL_TO) сервис молча выключен;
//   • отправка НИКОГДА не бросает исключение — сбой алерта не должен ломать запрос пользователя;
//   • антифлуд: одна и та же ошибка (по `key`) уходит не чаще окна (по умолчанию 5 минут),
//     а при следующей отправке в текст добавляется «повторилось N раз»;
//   • текст обрезается до лимита Telegram (4096), у нас 3900 символов.
import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../auth/email.service';

export interface AlertPayload {
  /** ключ антифлуда: например, `http500:GET /materials:TypeError` */
  key: string;
  /** короткий заголовок (уходит первой строкой) */
  title: string;
  /** детали: сообщение, стек, url, ip — что поможет воспроизвести */
  details?: string;
}

interface FloodState {
  /** сколько раз ошибка случилась внутри текущего окна */
  repeats: number;
  /** когда отправляли в последний раз */
  lastSentAt: number;
}

@Injectable()
export class TelegramAlertsService {
  private readonly logger = new Logger('Alerts');
  private readonly flood = new Map<string, FloodState>();

  private readonly token: string;
  private readonly chatId: string;
  private readonly apiBase: string;
  private readonly windowMs: number;
  private readonly environment: string;
  private readonly emailTo: string;

  constructor(private readonly email?: EmailService) {
    this.token = (process.env.TELEGRAM_ALERT_BOT_TOKEN || '').trim();
    this.chatId = (process.env.TELEGRAM_ALERT_CHAT_ID || '').trim();
    // База API вынесена в env — так тесты и проверка могут подставить локальный фейк.
    this.apiBase = (
      process.env.TELEGRAM_ALERT_API_BASE || 'https://api.telegram.org'
    ).replace(/\/+$/, '');
    const windowMs = Number(
      process.env.TELEGRAM_ALERT_WINDOW_MS || 5 * 60 * 1000,
    );
    this.windowMs =
      Number.isFinite(windowMs) && windowMs >= 0 ? windowMs : 5 * 60 * 1000;
    this.environment =
      process.env.APP_ENV || process.env.NODE_ENV || 'development';
    // ⭐ №396: резервный канал — почта (адрес задаётся явно, чтобы не писать «куда-нибудь»).
    this.emailTo = (process.env.ALERT_EMAIL_TO || '').trim();
  }

  /** Есть ли хоть один рабочий канал. */
  isEnabled(): boolean {
    return this.telegramEnabled() || this.emailEnabled();
  }

  private telegramEnabled(): boolean {
    return Boolean(this.token && this.chatId);
  }

  private emailEnabled(): boolean {
    return Boolean(this.emailTo && this.email && this.email.isConfigured());
  }

  /** Отправить алерт с учётом антифлуда. Никогда не бросает. */
  async notify(payload: AlertPayload): Promise<void> {
    if (!this.isEnabled()) return;
    const now = Date.now();
    const state = this.flood.get(payload.key);

    if (state && now - state.lastSentAt < this.windowMs) {
      state.repeats += 1;
      return;
    }

    const repeatNote =
      state && state.repeats > 0
        ? `🔁 повторилось ${state.repeats} раз(а) за окно\n\n`
        : '';
    this.flood.set(payload.key, { repeats: 0, lastSentAt: now });
    if (this.flood.size > 500) this.flood.clear(); // страховка от роста карты

    const text = `${repeatNote}${this.format(payload)}`;

    // Основной канал — Telegram; если он недоступен (нет настроек или сеть блокирует),
    // алерт уходит письмом, чтобы не потеряться.
    const sentToTelegram = await this.sendTelegram(text);
    if (!sentToTelegram) await this.sendEmail(payload, text);
  }

  private format({ title, details }: AlertPayload): string {
    const head = `🚨 ${this.environment.toUpperCase()} · ${title}`;
    const tail = new Date().toISOString();
    const text = [head, (details || '').trim(), tail]
      .filter(Boolean)
      .join('\n\n');
    return text.length > 3900 ? `${text.slice(0, 3900)}…` : text;
  }

  /** true — доставлено в Telegram (или канал не настроен, тогда решает e-mail). */
  private async sendTelegram(text: string): Promise<boolean> {
    if (!this.telegramEnabled()) return false;
    const url = `${this.apiBase}/bot${this.token}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `Telegram ответил ${response.status}: ${body.slice(0, 200)}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      // Сюда попадает и «fetch failed» из-за блокировки api.telegram.org в сети.
      this.logger.warn(
        `не удалось отправить алерт в Telegram: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private async sendEmail(payload: AlertPayload, text: string): Promise<void> {
    if (!this.emailEnabled()) {
      this.logger.warn(
        `алерт не доставлен (нет рабочего канала): ${payload.title}`,
      );
      return;
    }
    try {
      await this.email?.sendAlertEmail(
        this.emailTo,
        `[FRAME] ${this.environment.toUpperCase()} · ${payload.title}`,
        text,
      );
    } catch (error) {
      this.logger.warn(
        `не удалось отправить алерт письмом: ${(error as Error).message}`,
      );
    }
  }
}
