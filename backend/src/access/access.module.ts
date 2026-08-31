// backend/src/access/access.module.ts
import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AccessController],
  providers: [AccessService],
})
export class AccessModule {}