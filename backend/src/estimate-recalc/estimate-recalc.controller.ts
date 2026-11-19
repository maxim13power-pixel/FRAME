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

/** ⭐ №337: процент из query — пусто/мусор → undefined (наценки нет) */
function toPercent(value?: string): number | undefined {
  if (value == null || value.trim() === '') return undefined;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class EstimateRecalcController {
  constructor(private readonly recalcService: EstimateRecalcService) {}

  // Превью: что и как изменится. Ничего не пишет.
  // ⭐ №337: справочник и наценки можно выбрать прямо в модалке.
  @Get(':id/price-recalc/preview')
  preview(
    @Param('id', ParseIntPipe) id: number,
    @Query('catalogId') catalogId: string | undefined,
    @Query('workMarkupPercent') workPercent: string | undefined,
    @Query('materialMarkupPercent') materialPercent: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const parsed = catalogId ? parseInt(catalogId, 10) : undefined;
    return this.recalcService.preview(
      id,
      req.user.userId,
      Number.isNaN(parsed as number) ? undefined : parsed,
      {
        workMarkupPercent: toPercent(workPercent),
        materialMarkupPercent: toPercent(materialPercent),
      },
    );
  }

  // Применение: пишет строки с новой ценой (включая строки с фиксациями) + снимок в аудит.
  @Post(':id/price-recalc')
  apply(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: RecalcDto,
    @Req() req: AuthedRequest,
  ) {
    return this.recalcService.apply(id, dto.catalogId, req.user.userId, {
      workMarkupPercent: dto.workMarkupPercent,
      materialMarkupPercent: dto.materialMarkupPercent,
    });
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
