import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
