// backend/src/captcha/captcha.module.ts
// ⭐ Модуль Yandex SmartCaptcha
// Импортируется в AuthModule, где используются register/forgot-password endpoints

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { CaptchaService } from './captcha.service';

@Module({
  imports: [
    // HttpModule — нативный NestJS-модуль для HTTP-запросов через axios
    HttpModule.register({
      // Глобальный timeout на случай, если мы забудем его в RxJS-пайпе
      timeout: 5000,
      // Не более 3 редиректов — защита от зацикливания
      maxRedirects: 3,
    }),
    // ConfigModule нужен для чтения SMARTCAPTCHA_SERVER_KEY из env
    ConfigModule,
  ],
  providers: [CaptchaService],
  // ⭐ Экспортируем сервис, чтобы другие модули (AuthModule) могли его инжектить
  exports: [CaptchaService],
})
export class CaptchaModule {}