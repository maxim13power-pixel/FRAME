// backend/src/access/me-access.controller.ts
// ⭐ №168: «Мои доступы» — личный архив и список доступов пользователя.
// Отдельный контроллер: это НЕ управление объектом, а личное пространство,
// поэтому доступ к нему не зависит от роли в объекте (и работает для отозванных).
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from './access.service';

class SetHiddenDto {
  @IsBoolean()
  isHidden!: boolean;
}

@Controller('me/access')
@UseGuards(JwtAuthGuard)
export class MeAccessController {
  constructor(private readonly accessService: AccessService) {}

  // GET /me/access — мои доступы: активные / архив / отозванные
  @Get()
  listMine(@Req() req) {
    return this.accessService.listMine(req.user.userId);
  }

  // PATCH /me/access/:id — убрать/вернуть объект в ЛИЧНЫЙ архив
  @Patch(':id')
  setHidden(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetHiddenDto,
    @Req() req,
  ) {
    return this.accessService.setHidden(id, req.user.userId, dto.isHidden);
  }
}
