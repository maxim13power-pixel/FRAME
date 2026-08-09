import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, ParseIntPipe, ValidationPipe } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  //@Post()
  //create(@Body() dto: CreateProjectDto) {
    //return this.projectsService.create(dto);
  //}
  @Post()
  create(@Body(new ValidationPipe({ whitelist: true })) dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }
  @Get('object/:objectId')
  findAllByObject(@Param('objectId', ParseIntPipe) objectId: number) {
    return this.projectsService.findAllByObject(objectId);
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