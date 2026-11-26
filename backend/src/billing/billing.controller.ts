// backend/src/billing/billing.controller.ts
// ⭐ №404 (этап 0): только чтение тарифа и счётчиков. Ничего не блокирует.
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** GET /billing/me — тариф, лимиты, использовано/осталось (для плашек и апселла) */
  @Get('me')
  me(@Req() req: { user: { userId: number } }) {
    return this.billing.getSnapshot(req.user.userId);
  }
}
