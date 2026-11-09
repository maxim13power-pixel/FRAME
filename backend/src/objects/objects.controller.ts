// backend/src/objects/objects.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ObjectsService } from './objects.service';
import { ObjectDeletionService } from './object-deletion.service';
import { CreateObjectDto } from './dto/create-object.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ObjectAccessGuard } from '../auth/object-access.guard';

@Controller('objects')
@UseGuards(JwtAuthGuard, ObjectAccessGuard) // JWT + централизованная проверка доступа к объекту
export class ObjectsController {
  constructor(
    private readonly objectsService: ObjectsService,
    private readonly deletion: ObjectDeletionService,
  ) {}

  @Post()
  create(@Body() createObjectDto: CreateObjectDto, @Req() req) {
    return this.objectsService.create(createObjectDto, req.user.userId);
  }

  @Get()
  findAll(@Req() req) {
    return this.objectsService.findAll(req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateObjectDto>,
    @Req() req,
  ) {
    return this.objectsService.update(id, dto, req.user.userId);
  }

  // ⚠️ №168: глобального архива и жёсткого удаления объектов больше нет.
  // Личный архив участника — PATCH /me/access/:id (см. MeAccessController).
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.objectsService.findOne(id, req.user.userId);
  }

  @Patch(':id/end-date')
  updateEndDate(
    @Param('id', ParseIntPipe) id: number,
    @Body('endDate') endDate: string,
    @Req() req,
  ) {
    return this.objectsService.updateEndDate(id, endDate, req.user.userId);
  }

  /** ⭐ №246: назначить безвозвратное удаление через 30 дней (только админ объекта). */
  @Post(':id/deletion')
  scheduleDeletion(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.deletion.schedule(id, req.user.userId);
  }

  /** ⭐ №246: отменить запланированное удаление. */
  @Delete(':id/deletion')
  cancelDeletion(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.deletion.cancel(id, req.user.userId);
  }
}
