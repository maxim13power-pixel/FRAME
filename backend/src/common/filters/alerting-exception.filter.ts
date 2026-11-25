// backend/src/common/filters/alerting-exception.filter.ts
// ⭐ №396: глобальный фильтр, который НЕ меняет ответы API, но сообщает об ошибках в Telegram.
// Наследуемся от BaseExceptionFilter — формат ответа остаётся прежним (фронт ждёт `message`),
// а мы лишь добавляем побочный эффект для 5xx/необработанных исключений.
import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { HttpServer } from '@nestjs/common';
import type { TelegramAlertsService } from '../alerts/telegram-alerts.service';

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  body?: unknown;
  user?: { userId?: number };
}

/** Статус ответа для исключения: HttpException — свой, всё остальное — 500. */
export const exceptionStatus = (exception: unknown): number =>
  exception instanceof HttpException
    ? exception.getStatus()
    : HttpStatus.INTERNAL_SERVER_ERROR;

@Catch()
export class AlertingExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('Errors');

  constructor(
    applicationRef: HttpServer,
    private readonly alerts: TelegramAlertsService,
  ) {
    super(applicationRef);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const status = exceptionStatus(exception);
    if (status >= 500) {
      const request = host.switchToHttp().getRequest<RequestLike>();
      const message =
        exception instanceof Error
          ? `${exception.name}: ${exception.message}`
          : String(exception);
      const stack =
        exception instanceof Error
          ? (exception.stack || '').split('\n').slice(0, 6).join('\n')
          : '';
      const route = `${request?.method || '?'} ${request?.originalUrl || request?.url || ''}`;
      this.logger.error(`${route} → ${status}: ${message}`);
      void this.alerts.notify({
        // ключ без id/тела: одна и та же ошибка на одном маршруте схлопывается антифлудом
        key: `http500:${route}:${message.slice(0, 120)}`,
        title: `HTTP ${status} · ${route}`,
        details: [message, stack, request?.ip ? `ip: ${request.ip}` : '']
          .filter(Boolean)
          .join('\n\n'),
      });
    }
    // Ответ формирует базовый фильтр — поведение API не меняется.
    super.catch(exception, host);
  }
}
