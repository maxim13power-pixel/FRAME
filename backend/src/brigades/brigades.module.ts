// backend/src/brigades/brigades.module.ts
// ⭐ Срез 4: бригады — учёт выходов и выработки.
import { Module } from '@nestjs/common';
import { BrigadesController } from './brigades.controller';
import { BrigadesService } from './brigades.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BrigadesController],
  providers: [BrigadesService],
  exports: [BrigadesService],
})
export class BrigadesModule {}
