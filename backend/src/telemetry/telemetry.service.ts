// backend/src/telemetry/telemetry.service.ts
// ⭐ №396: приём ошибок из браузера и превращение их в Telegram-алерт.
//
// Почему с лимитами: эндпоинт публичный (без токена), а алерт уходит в Telegram. Без ограничений
// один «весёлый» браузер мог бы завалить канал. Поэтому лимит на IP и общий лимит в минуту,
// плюс антифлуд в самом сервисе алертов (по ключу ошибки).
import { Injectable, Logger } from '@nestjs/common';
import { TelegramAlertsService } from '../common/alerts/telegram-alerts.service';
import type { ClientErrorDto } from './dto/client-error.dto';

const WINDOW_MS = 60_000;

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger('Telemetry');
  private readonly perIp = new Map<string, number[]>();
  private total: number[] = [];
  private readonly maxPerIp: number;
  private readonly maxTotal: number;

  constructor(private readonly alerts: TelegramAlertsService) {
    // Читаем env в конструкторе (а не на уровне модуля) — так лимиты можно менять в тестах.
    const perIp = Number(process.env.CLIENT_ERROR_LIMIT_PER_MIN || 5);
    const total = Number(process.env.CLIENT_ERROR_LIMIT_TOTAL_PER_MIN || 30);
    this.maxPerIp = Number.isFinite(perIp) && perIp > 0 ? perIp : 5;
    this.maxTotal = Number.isFinite(total) && total > 0 ? total : 30;
  }

  /** Принять ошибку фронта. Всегда молча: клиент не должен знать, приняли мы её или отбросили. */
  report(dto: ClientErrorDto, ip: string): void {
    if (!this.allow(ip)) {
      this.logger.debug(`ошибка фронта отброшена лимитом (ip ${ip})`);
      return;
    }
    this.alerts
      .notify({
        // одинаковые ошибки схлопываются антифлудом сервиса алертов
        key: `client:${dto.message.slice(0, 120)}`,
        title: `Ошибка в браузере · ${dto.context || 'window.error'}`,
        details: [
          dto.message,
          dto.url ? `страница: ${dto.url}` : '',
          dto.stack ? dto.stack.split('\n').slice(0, 8).join('\n') : '',
          `ip: ${ip}`,
          dto.userAgent ? `ua: ${dto.userAgent}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      })
      .catch(() => undefined); // notify и так не бросает, но подстрахуемся
  }

  /** Скользящее окно: не больше MAX_PER_IP с одного IP и MAX_TOTAL всего за минуту. */
  private allow(ip: string): boolean {
    const now = Date.now();
    this.total = this.total.filter((at) => now - at < WINDOW_MS);
    if (this.total.length >= this.maxTotal) return false;

    const hits = (this.perIp.get(ip) || []).filter(
      (at) => now - at < WINDOW_MS,
    );
    if (hits.length >= this.maxPerIp) {
      this.perIp.set(ip, hits);
      return false;
    }
    hits.push(now);
    this.perIp.set(ip, hits);
    this.total.push(now);
    if (this.perIp.size > 1000) this.perIp.clear(); // страховка от роста карты
    return true;
  }
}
