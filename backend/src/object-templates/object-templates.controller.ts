// backend/src/object-templates/object-templates.controller.ts
// ⭐ №175: шаблоны объектов
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
import { ObjectTemplatesService } from './object-templates.service';
import { CreateObjectTemplateDto } from './dto/create-object-template.dto';
import { UpdateObjectTemplateDto } from './dto/update-object-template.dto';
import { CreateObjectFromTemplateDto } from './dto/create-object-from-template.dto';

@Controller('object-templates')
@UseGuards(JwtAuthGuard)
export class ObjectTemplatesController {
  constructor(private readonly service: ObjectTemplatesService) {}

  // POST /object-templates — сохранить объект как шаблон
  @Post()
  create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: CreateObjectTemplateDto,
    @Req() req,
  ) {
    return this.service.createFromObject(dto.objectId, dto, req.user.userId);
  }

  // GET /object-templates?scope=mine|all
  @Get()
  findAll(@Req() req, @Query('scope') scope?: string) {
    return this.service.findAll(
      req.user.userId,
      scope === 'mine' ? 'mine' : 'all',
    );
  }

  // GET /object-templates/:id — шаблон с позициями
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.service.findOne(id, req.user.userId);
  }

  // PATCH /object-templates/:id — переименовать / опубликовать
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateObjectTemplateDto,
    @Req() req,
  ) {
    return this.service.update(id, dto, req.user.userId);
  }

  // DELETE /object-templates/:id — удалить (автор или админ)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.service.remove(id, req.user.userId);
  }

  // POST /object-templates/:id/create-object — создать объект из шаблона
  @Post(':id/create-object')
  createObject(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: CreateObjectFromTemplateDto,
    @Req() req,
  ) {
    return this.service.createObject(id, dto, req.user.userId);
  }
}
