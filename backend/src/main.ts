import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { TelegramAlertsService } from './common/alerts/telegram-alerts.service';
import { AlertingExceptionFilter } from './common/filters/alerting-exception.filter';

/** ⭐ №396: аварийные ситуации процесса — логируем, шлём алерт и завершаемся (платформа поднимет). */
function installFatalHandlers(alerts: TelegramAlertsService): void {
  const logger = new Logger('Fatal');
  const handle = (kind: string, error: unknown) => {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const stack = error instanceof Error ? (error.stack || '').split('\n').slice(0, 8).join('\n') : '';
    logger.error(`${kind}: ${message}`);
    // Алерт ждём максимум 5 секунд (внутри fetch с AbortSignal), потом всё равно выходим.
    void alerts
      .notify({ key: `fatal:${kind}:${message.slice(0, 120)}`, title: `Процесс упал · ${kind}`, details: [message, stack].filter(Boolean).join('\n\n') })
      .finally(() => process.exit(1));
  };
  process.on('uncaughtException', (error) => handle('uncaughtException', error));
  process.on('unhandledRejection', (reason) => handle('unhandledRejection', reason));
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ⭐ №396: глобальный фильтр, который не меняет ответы API, но сообщает о 5xx в Telegram.
  const alerts = app.get(TelegramAlertsService);
  app.useGlobalFilters(new AlertingExceptionFilter(app.getHttpAdapter(), alerts));
  installFatalHandlers(alerts);
  if (alerts.isEnabled()) {
    new Logger('Alerts').log('алерты об ошибках включены (Telegram)');
  }

  // ⭐ №202 (RFC §8.7): JSON-предпросмотр импорта сметы шлёт до 500 строк —
  // дефолтные 100 КБ не проходят. Файл (multipart) ограничен отдельно в контроллере (2 МБ).
  app.useBodyParser('json', { limit: '2mb' });

  // ⭐ Глобальный ValidationPipe: отсекает лишнее + авто-преобразование типов
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // отсекает поля, которых нет в DTO
      forbidNonWhitelisted: true, // кидает 400 если прислали лишнее
      transform: true, // auto "1" -> 1 для @Type(() => Number)
    }),
  );

  // ⭐ P0-3: CORS whitelist — пускаем только фронтенд, а не любой домен.
  // Локально работают дефолты для Vite (:5000).
  // В проде (Railway) добавь в backend/.env:
  //   CORS_ORIGINS=https://твой-фронт-домен.up.railway.app
  const allowedOrigins = (
    process.env.CORS_ORIGINS || 'http://localhost:5000,http://127.0.0.1:5000'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}
bootstrap();
