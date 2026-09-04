// backend/src/objects/objects.controller.ts
import { Controller, Get, Post, Body, Param, Delete, Patch, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ObjectsService } from './objects.service';
import { CreateObjectDto } from './dto/create-object.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ObjectAccessGuard } from '../auth/object-access.guard';

@Controller('objects')
@UseGuards(JwtAuthGuard, ObjectAccessGuard) // JWT + централизованная проверка доступа к объекту
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  @Post()
  create(@Body() createObjectDto: CreateObjectDto, @Req() req) {
    return this.objectsService.create(createObjectDto, req.user.userId);
  }

  @Get()
  findAll(@Req() req) {
    return this.objectsService.findAll(req.user.userId);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateObjectDto>, @Req() req) {
    return this.objectsService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.objectsService.remove(id, req.user.userId);
  }

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
}