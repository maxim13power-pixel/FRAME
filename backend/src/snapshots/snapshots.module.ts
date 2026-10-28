// backend/src/snapshots/snapshots.module.ts
import { Module } from '@nestjs/common';
import { SnapshotsController } from './snapshots.controller';
import { SnapshotsService } from './snapshots.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SnapshotsController],
  providers: [SnapshotsService],
})
export class SnapshotsModule {}
