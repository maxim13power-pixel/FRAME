// backend/src/common/email/email.module.ts
// ⭐ №396: EmailService переиспользуется не только в авторизации, но и в алертах
// (резервный канал, если Telegram из сети недоступен). Сам файл сервиса остаётся на месте —
// выносим только провайдер в общий модуль, чтобы не дублировать настройки SMTP.
import { Module } from '@nestjs/common';
import { EmailService } from '../../auth/email.service';

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
