// backend/src/objects/objects.controller.ts
import { Controller, Get, Post, Body, UseGuards, Patch, Delete, ParseIntPipe, Param } from '@nestjs/common';
import { ObjectsService } from './objects.service';
import { CreateObjectDto } from './dto/create-object.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // защита – только авторизованные


@Controller('objects')
@UseGuards(JwtAuthGuard) // все методы требуют авторизации
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  @Post()
  create(@Body() dto: CreateObjectDto) {
    return this.objectsService.create(dto);
  }

  @Get()
  findAll() {
    return this.objectsService.findAll();
  }
@Patch(':id')
update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateObjectDto>) {
  return this.objectsService.update(id, dto);
}

@Delete(':id')
remove(@Param('id', ParseIntPipe) id: number) {
  return this.objectsService.remove(id);
}

@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.objectsService.findOne(id);
}

@Patch(':id/end-date')
updateEndDate(
  @Param('id', ParseIntPipe) id: number,
  @Body('endDate') endDate: string,
) {
  return this.objectsService.updateEndDate(id, endDate);
}
}