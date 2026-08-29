//import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, ParseIntPipe, ValidationPipe } from '@nestjs/common';
import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, ParseIntPipe, ValidationPipe, Put, Req } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgAccessGuard } from '../auth/org-access.guard';
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, OrgAccessGuard)
  create(@Body() createProjectDto: CreateProjectDto, @Req() req) {
    return this.projectsService.create(createProjectDto, req.user.orgId);
  }

   @Get('object/:objectId')
  @UseGuards(JwtAuthGuard, OrgAccessGuard)
  findAllByObject(@Param('objectId', ParseIntPipe) objectId: number, @Req() req) {
    return this.projectsService.findAllByObject(objectId, req.user.orgId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CreateProjectDto>) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.remove(id);
  }
}