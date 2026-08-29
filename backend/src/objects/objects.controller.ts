// backend/src/objects/objects.controller.ts
//import { Controller, Get, Post, Body, UseGuards, Patch, Delete, ParseIntPipe, Param } from '@nestjs/common';
import { Controller, Get, Post, Body, Param, Delete, Patch, Put, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ObjectsService } from './objects.service';
import { CreateObjectDto } from './dto/create-object.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; 
import { OrgAccessGuard } from '../auth/org-access.guard';

@Controller('objects')
@UseGuards(JwtAuthGuard) // все методы требуют авторизации
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, OrgAccessGuard)
  create(@Body() createObjectDto: CreateObjectDto, @Req() req) {
    return this.objectsService.create(createObjectDto, req.user.orgId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, OrgAccessGuard)
  findAll(@Req() req) {
    return this.objectsService.findAll(req.user.orgId);
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