// backend/src/billing/billing.module.ts
// ⭐ №404/№407: тарифы, лимиты и авторизация экспорта.
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { LimitsService } from './limits.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, LimitsService],
  exports: [BillingService, LimitsService],
})
export class BillingModule {}
