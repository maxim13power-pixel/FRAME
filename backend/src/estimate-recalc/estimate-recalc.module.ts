// backend/src/estimate-recalc/estimate-recalc.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EstimateRecalcController } from './estimate-recalc.controller';
import { EstimateRecalcService } from './estimate-recalc.service';

@Module({
  imports: [PrismaModule],
  controllers: [EstimateRecalcController],
  providers: [EstimateRecalcService],
})
export class EstimateRecalcModule {}
