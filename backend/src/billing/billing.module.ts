// backend/src/billing/billing.module.ts
// ⭐ №404: тарифы и лимиты (этап 0 — только чтение).
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
