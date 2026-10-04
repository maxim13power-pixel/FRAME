import { Module } from '@nestjs/common';
import { EstimateTemplatesController } from './estimate-templates.controller';
import { EstimateTemplatesService } from './estimate-templates.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EstimateTemplatesController],
  providers: [EstimateTemplatesService],
})
export class EstimateTemplatesModule {}
