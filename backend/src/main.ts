import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ⭐ Глобальный ValidationPipe: отсекает лишнее + авто-преобразование типов
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // отсекает поля, которых нет в DTO
      forbidNonWhitelisted: true, // кидает 400 если прислали лишнее
      transform: true,            // auto "1" -> 1 для @Type(() => Number)
    }),
  );

// ⭐ P0-3: CORS whitelist — пускаем только фронтенд, а не любой домен.
// Локально работают дефолты для Vite (:5000).
// В проде (Railway) добавь в backend/.env:
//   CORS_ORIGINS=https://твой-фронт-домен.up.railway.app
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5000,http://127.0.0.1:5000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.enableCors({
  origin: allowedOrigins,
  credentials: true,
});

  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}
bootstrap();