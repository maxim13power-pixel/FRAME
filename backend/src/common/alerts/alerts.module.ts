// backend/src/common/alerts/alerts.module.ts
// ⭐ №396: глобальный модуль алертов — сервис нужен и фильтру исключений, и телеметрии фронта.
import { Global, Module } from '@nestjs/common';
import { TelegramAlertsService } from './telegram-alerts.service';

@Global()
@Module({
  providers: [TelegramAlertsService],
  exports: [TelegramAlertsService],
})
export class AlertsModule {}
