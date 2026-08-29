// backend/src/dashboard/dashboard.controller.ts
import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgAccessGuard } from '../auth/org-access.guard';
import { DashboardService } from './dashboard.service';
import type { DashboardSummaryDto } from './dashboard.types';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, OrgAccessGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@Req() req) {
    return this.dashboardService.getSummary(req.user.orgId);
  }
}