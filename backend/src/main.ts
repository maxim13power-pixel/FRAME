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

  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}
bootstrap();