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
  getAccessList(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Req() req,
  ) {
    return this.accessService.getAccessList(objectId, req.user.userId);
  }

  // POST /objects/:objectId/access — пригласить
  @Post()
  addAccess(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: AddAccessDto,
    @Req() req,
  ) {
    return this.accessService.addAccess(objectId, dto, req.user.userId);
  }

  // PATCH /objects/:objectId/access/:accessId — сменить роль
  @Patch(':accessId')
  updateAccess(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Param('accessId', ParseIntPipe) accessId: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: UpdateAccessDto,
    @Req() req,
  ) {
    return this.accessService.updateAccess(objectId, accessId, dto, req.user.userId);
  }

  // DELETE /objects/:objectId/access/:accessId — отозвать доступ (уволить воригу 🚪)
  @Delete(':accessId')
  removeAccess(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Param('accessId', ParseIntPipe) accessId: number,
    @Req() req,
  ) {
    return this.accessService.removeAccess(objectId, accessId, req.user.userId);
  }
}