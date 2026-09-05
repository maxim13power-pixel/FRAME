// backend/src/projects/projects.controller.ts
import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ObjectAccessGuard } from '../auth/object-access.guard';

@Controller('projects')
@UseGuards(JwtAuthGuard, ObjectAccessGuard)
// ⭐ Guard проверяет доступ по params.objectId для GET /object/:objectId.
// Для /projects/:id (params.id = projectId) guard пропускает (нет objectId),
// проверка остаётся в ProjectsService.findOne/update/remove.
// TODO: добавить резолв projectId→objectId в guard для полной централизации.
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@Body() createProjectDto: CreateProjectDto, @Req() req) {
    return this.projectsService.create(createProjectDto, req.user.userId);
  }

  @Get('object/:objectId')
  findAllByObject(@Param('objectId', ParseIntPipe) objectId: number, @Req() req) {
    return this.projectsService.findAllByObject(objectId, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.projectsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateProjectDto>, @Req() req) {
    return this.projectsService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.projectsService.remove(id, req.user.userId);
  }
}