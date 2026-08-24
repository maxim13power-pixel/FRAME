// backend/src/dashboard/dashboard.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import type { DashboardSummaryDto } from './dashboard.types';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  // TODO: orgId после мульти-тенантности — доставать из req.user и прокидывать в service.
  async getSummary(): Promise<DashboardSummaryDto> {
    return this.dashboard.getSummary();
  }
}