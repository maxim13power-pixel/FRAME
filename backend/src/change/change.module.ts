// backend/src/change/change.module.ts
// ⭐ P0-6: модуль розовых согласований
import { Module } from '@nestjs/common';
import { ChangeService } from './change.service';
import { ChangeController } from './change.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ChangeController],
  providers: [ChangeService],
  exports: [ChangeService], // на будущее, если понадобится в других модулях
})
export class ChangeModule {}