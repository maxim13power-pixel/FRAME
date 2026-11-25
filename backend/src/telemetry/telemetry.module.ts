// backend/src/telemetry/telemetry.module.ts
// ⭐ №396: ошибки из браузера → Telegram (модуль без БД: ничего не храним, только уведомляем).
import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  controllers: [TelemetryController],
  providers: [TelemetryService],
})
export class TelemetryModule {}
