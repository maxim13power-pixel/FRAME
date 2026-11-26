// backend/src/access/access.module.ts
import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { MeAccessController } from './me-access.controller'; // ⭐ №168
import { AccessService } from './access.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module'; // ⭐ №408: лимиты участников

@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [AccessController, MeAccessController],
  providers: [AccessService],
  // ⭐ №249: проектный доступ удаляется через ProjectsModule
  exports: [AccessService],
})
export class AccessModule {}
