// backend/src/common/alerts/alerts.module.ts
// ⭐ №396: глобальный модуль алертов — сервис нужен и фильтру исключений, и телеметрии фронта.
// Почта — резервный канал, поэтому импортируем EmailModule (настройки SMTP не дублируем).
import { Global, Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { TelegramAlertsService } from './telegram-alerts.service';

@Global()
@Module({
  imports: [EmailModule],
  providers: [TelegramAlertsService],
  exports: [TelegramAlertsService],
})
export class AlertsModule {}
