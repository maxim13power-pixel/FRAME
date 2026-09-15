// backend/src/change/change.controller.ts
// ⭐ P0-6: API розовых согласований.
// Проверка доступа — ВНУТРИ сервиса (getAccess),
// поэтому на классе только JwtAuthGuard (ObjectAccessGuard не нужен:
// работаем по projectId, а не по :id-параметру).
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChangeService } from './change.service';
import { CreateChangeDto } from './dto/create-change.dto';
import { ReviewChangeDto } from './dto/review-change.dto';

@Controller('change')
@UseGuards(JwtAuthGuard)
export class ChangeController {
  constructor(private readonly changeService: ChangeService) {}

  // ⭐ Список заявок по проекту (VIEWER получает payload без цен)
  @Get('project/:projectId')
  list(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req,
  ) {
    return this.changeService.list(req.user.userId, projectId);
  }

  // ⭐ Создать заявку (FOREMAN/CUSTOMER)
  @Post()
  create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: CreateChangeDto,
    @Req() req,
  ) {
    return this.changeService.create(req.user.userId, dto);
  }

  // ⭐ Согласовать / отклонить (только FOREMAN/CUSTOMER, не своя заявка)
  @Patch(':id/review')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: ReviewChangeDto,
    @Req() req,
  ) {
    return this.changeService.review(req.user.userId, id, dto);
  }
}