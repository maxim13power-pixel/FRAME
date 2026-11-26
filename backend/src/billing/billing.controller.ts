// backend/src/billing/billing.controller.ts
// ⭐ №404/№405: тариф, счётчики и авторизация экспорта. Ничего не удаляет.
import { Body, Controller, Get, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import { AuthorizePdfDto } from './dto/authorize-pdf.dto';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** GET /billing/me — тариф, лимиты, использовано/осталось (для плашек и апселла) */
  @Get('me')
  me(@Req() req: { user: { userId: number } }) {
    return this.billing.getSnapshot(req.user.userId);
  }

  /**
   * ⭐ №405: разрешение на PDF-экспорт (payload-bound токен, idempotency по содержимому).
   * См. `docs/PRICING.md` §8.2: повтор того же документа не списывает, другой — новое списание.
   */
  @Post('exports/pdf/authorize')
  authorizePdf(
    @Req() req: { user: { userId: number } },
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: AuthorizePdfDto,
  ) {
    return this.billing.authorizePdfExport(req.user.userId, dto);
  }
}
