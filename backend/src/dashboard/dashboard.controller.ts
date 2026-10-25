// backend/src/dashboard/dashboard.controller.ts
import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import type { DashboardSummaryDto } from './dashboard.types';

/** Запрос после JwtAuthGuard — только то, что нужно контроллеру */
interface AuthedRequest {
  user: { userId: number };
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(
    @Req() req: AuthedRequest,
    @Query('tzOffset') tzOffset?: string,
  ): Promise<DashboardSummaryDto> {
    // ⭐ №173: смещение часового пояса клиента в минутах (Date#getTimezoneOffset),
    // чтобы «неделя Пн→Вс» и «сегодня» считались по локальным суткам пользователя.
    // Нет параметра / мусор → считаем по зоне сервера.
    const parsed = tzOffset && tzOffset.trim() !== '' ? Number(tzOffset) : NaN;
    return this.dashboardService.getSummary(
      req.user.userId,
      Number.isFinite(parsed) && Math.abs(parsed) <= 840 ? parsed : undefined,
    );
  }
}
