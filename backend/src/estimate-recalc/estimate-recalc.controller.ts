// backend/src/estimate-recalc/estimate-recalc.controller.ts
// ⭐ №170: пересчёт сметы по справочнику цен.
// Доступ проверяет сервис (как в projects.service): маршруты висят на /projects/:id,
// поэтому ObjectAccessGuard здесь не нужен.
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EstimateRecalcService } from './estimate-recalc.service';
import { RecalcDto } from './dto/recalc.dto';

/** Запрос после JwtAuthGuard — только то, что нужно контроллеру */
interface AuthedRequest {
  user: { userId: number };
}

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class EstimateRecalcController {
  constructor(private readonly recalcService: EstimateRecalcService) {}

  // Превью: что и как изменится. Ничего не пишет.
  @Get(':id/price-recalc/preview')
  preview(
    @Param('id', ParseIntPipe) id: number,
    @Query('catalogId') catalogId: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const parsed = catalogId ? parseInt(catalogId, 10) : undefined;
    return this.recalcService.preview(
      id,
      req.user.userId,
      Number.isNaN(parsed as number) ? undefined : parsed,
    );
  }

  // Применение: пишет только строки без фиксаций + снимок версии в аудит.
  @Post(':id/price-recalc')
  apply(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: RecalcDto,
    @Req() req: AuthedRequest,
  ) {
    return this.recalcService.apply(id, dto.catalogId, req.user.userId);
  }

  // История пересчётов проекта (версии для отката).
  @Get(':id/price-recalc/history')
  history(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.recalcService.history(id, req.user.userId);
  }

  // Откат к состоянию ДО указанной версии.
  @Post(':id/price-recalc/:auditId/rollback')
  rollback(
    @Param('id', ParseIntPipe) id: number,
    @Param('auditId', ParseIntPipe) auditId: number,
    @Req() req: AuthedRequest,
  ) {
    return this.recalcService.rollback(id, auditId, req.user.userId);
  }
}
