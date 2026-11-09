import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { MeProjectsController } from './me-projects.controller';
import { ProjectAccessController } from './project-access.controller';
import { ProjectDeletionService } from './project-deletion.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ObjectsModule } from '../objects/objects.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, ObjectsModule, AccessModule],
  controllers: [ProjectsController, MeProjectsController, ProjectAccessController],
  providers: [ProjectsService, ProjectDeletionService],
})
export class ProjectsModule {}
