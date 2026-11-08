// backend/src/analytics/analytics.controller.ts
// ⭐ Срез 3: аналитика освоения бюджета.
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { parseObjectIdQuery } from './analytics.query';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  summary(@Req() req) {
    return this.analyticsService.getSummary(req.user.userId);
  }

  @Get('budget-vs-actual')
  budgetVsActual(@Req() req, @Query('objectId') objectId?: string) {
    // ⭐ №226 (§72): мусор в objectId → 400 (раньше Number('abc') = NaN и фильтр молча
    // отключался — эндпоинт отдавал ВСЕ доступные проекты)
    return this.analyticsService.getBudgetVsActual(
      req.user.userId,
      parseObjectIdQuery(objectId),
    );
  }

  @Get('monthly-trend')
  monthlyTrend(@Req() req, @Query('tzOffset') tzOffset?: string) {
    // ⭐ №226 (§72, P3-4): смещение зоны браузера (Date#getTimezoneOffset),
    // чтобы месяцы считались по локальным суткам, а не по UTC сервера.
    const parsed = tzOffset && tzOffset.trim() !== '' ? Number(tzOffset) : NaN;
    const offset =
      Number.isFinite(parsed) && Math.abs(parsed) <= 840 ? parsed : undefined;
    return this.analyticsService.getMonthlyTrend(req.user.userId, offset);
  }

  @Get('top-overrun')
  topOverrun(@Req() req) {
    return this.analyticsService.getTopOverrun(req.user.userId);
  }
}
