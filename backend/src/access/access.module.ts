// backend/src/access/access.module.ts
import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { MeAccessController } from './me-access.controller'; // ⭐ №168
import { AccessService } from './access.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AccessController, MeAccessController],
  providers: [AccessService],
})
export class AccessModule {}
