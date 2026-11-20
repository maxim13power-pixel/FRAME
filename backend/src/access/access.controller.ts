// backend/src/access/access.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from './access.service';
import { AddAccessDto } from './dto/add-access.dto';
import { UpdateAccessDto } from './dto/update-access.dto';

// ⭐ Вложенный роут: все эндпоинты живут внутри конкретного объекта
@Controller('objects/:objectId/access')
@UseGuards(JwtAuthGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  // GET /objects/:objectId/access — список участников
  @Get()
  getAccessList(@Param('objectId', ParseIntPipe) objectId: number, @Req() req) {
    return this.accessService.getAccessList(objectId, req.user.userId);
  }

  // ⭐ №350: GET /objects/:objectId/access/candidates — люди из команды моих объектов
  // (для прямого добавления без ссылки). ⭐ №352: `?projectId=` — область проверки «уже есть».
  @Get('candidates')
  getCandidates(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Req() req,
    @Query('projectId') projectId?: string,
  ) {
    const parsed =
      projectId && projectId.trim() !== '' ? Number(projectId) : undefined;
    return this.accessService.getCandidates(
      objectId,
      req.user.userId,
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  // POST /objects/:objectId/access — пригласить
  @Post()
  addAccess(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: AddAccessDto,
    @Req() req,
  ) {
    return this.accessService.addAccess(objectId, dto, req.user.userId);
  }

  // PATCH /objects/:objectId/access/:accessId — сменить роль
  @Patch(':accessId')
  updateAccess(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Param('accessId', ParseIntPipe) accessId: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateAccessDto,
    @Req() req,
  ) {
    return this.accessService.updateAccess(
      objectId,
      accessId,
      dto,
      req.user.userId,
    );
  }

  // DELETE /objects/:objectId/access/:accessId/only — ⭐ №341: убрать ТОЛЬКО эту область
  // (например, «убрать из проекта», оставив другие проекты). Последняя запись =
  // обычное удаление участника.
  @Delete(':accessId/only')
  removeGrant(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Param('accessId', ParseIntPipe) accessId: number,
    @Req() req,
  ) {
    return this.accessService.removeGrant(objectId, accessId, req.user.userId);
  }

  // DELETE /objects/:objectId/access/:accessId — ⭐ №207: удалить участника.
  // Перед удалением бэкенд снимает личные копии (шаблоны смет + снимок доступа).
  @Delete(':accessId')
  removeParticipant(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Param('accessId', ParseIntPipe) accessId: number,
    @Req() req,
  ) {
    return this.accessService.removeParticipant(
      objectId,
      accessId,
      req.user.userId,
    );
  }
}
