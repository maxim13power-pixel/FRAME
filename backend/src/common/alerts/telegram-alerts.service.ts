// backend/src/common/alerts/telegram-alerts.service.ts
// ⭐ №396: алерты об ошибках в Telegram (решение владельца 25.11.2026 — без Sentry).
//
// Принципы:
//   • без TELEGRAM_ALERT_BOT_TOKEN/CHAT_ID сервис молча выключен (dev и тесты работают как раньше);
//   • отправка НИКОГДА не бросает исключение — сбой алерта не должен ломать запрос пользователя;
//   • антифлуд: одна и та же ошибка (по `key`) уходит не чаще окна (по умолчанию 5 минут),
//     а при следующей отправке в текст добавляется «повторилось N раз»;
//   • текст обрезается до лимита Telegram (4096), у нас 3900 символов.
import { Injectable, Logger } from '@nestjs/common';

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

  constructor() {
    this.token = (process.env.TELEGRAM_ALERT_BOT_TOKEN || '').trim();
    this.chatId = (process.env.TELEGRAM_ALERT_CHAT_ID || '').trim();
    // База API вынесена в env — так тесты и проверка могут подставить локальный фейк.
    this.apiBase = (process.env.TELEGRAM_ALERT_API_BASE || 'https://api.telegram.org').replace(/\/+$/, '');
    const windowMs = Number(process.env.TELEGRAM_ALERT_WINDOW_MS || 5 * 60 * 1000);
    this.windowMs = Number.isFinite(windowMs) && windowMs >= 0 ? windowMs : 5 * 60 * 1000;
    this.environment = process.env.APP_ENV || process.env.NODE_ENV || 'development';
  }

  /** Настроен ли канал (есть токен и чат). */
  isEnabled(): boolean {
    return Boolean(this.token && this.chatId);
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

    const repeatNote = state && state.repeats > 0 ? `🔁 повторилось ${state.repeats} раз(а) за окно\n\n` : '';
    this.flood.set(payload.key, { repeats: 0, lastSentAt: now });
    if (this.flood.size > 500) this.flood.clear(); // страховка от роста карты

    await this.send(`${repeatNote}${this.format(payload)}`);
  }

  private format({ title, details }: AlertPayload): string {
    const head = `🚨 ${this.environment.toUpperCase()} · ${title}`;
    const tail = new Date().toISOString();
    const text = [head, (details || '').trim(), tail].filter(Boolean).join('\n\n');
    return text.length > 3900 ? `${text.slice(0, 3900)}…` : text;
  }

  private async send(text: string): Promise<void> {
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
        this.logger.warn(`Telegram ответил ${response.status}: ${body.slice(0, 200)}`);
      }
    } catch (error) {
      this.logger.warn(`не удалось отправить алерт: ${(error as Error).message}`);
    }
  }
}
