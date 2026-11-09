// backend/src/projects/me-projects.controller.ts
// ⭐ №249: личный архив проекта — скрыть/показать только у себя.
import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';

@Controller('me/projects')
@UseGuards(JwtAuthGuard)
export class MeProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Patch(':projectId')
  setHidden(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body('isHidden') isHidden: boolean,
    @Req() req,
  ) {
    return this.projects.setHidden(projectId, req.user.userId, !!isHidden);
  }
}
