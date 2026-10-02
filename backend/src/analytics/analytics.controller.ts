// backend/src/analytics/analytics.controller.ts
// ⭐ Срез 3: аналитика освоения бюджета.
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

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
    const oid = objectId === undefined || objectId === '' ? undefined : Number(objectId);
    return this.analyticsService.getBudgetVsActual(req.user.userId, oid);
  }

  @Get('monthly-trend')
  monthlyTrend(@Req() req) {
    return this.analyticsService.getMonthlyTrend(req.user.userId);
  }

  @Get('top-overrun')
  topOverrun(@Req() req) {
    return this.analyticsService.getTopOverrun(req.user.userId);
  }
}
