// backend/src/projects/project-access.controller.ts
// ⭐ №249: удаление участника ИМЕННО проекта (объектные доступы не трогаем).
import {
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from '../access/access.service';

@Controller('projects/:projectId/access')
@UseGuards(JwtAuthGuard)
export class ProjectAccessController {
  constructor(private readonly access: AccessService) {}

  @Delete(':accessId')
  remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('accessId', ParseIntPipe) accessId: number,
    @Req() req,
  ) {
    return this.access.removeProjectParticipant(
      projectId,
      accessId,
      req.user.userId,
    );
  }
}
