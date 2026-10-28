// backend/src/access-request/access-request.module.ts
// ⭐ №178: заявки на право создавать проекты в объекте
import { Module } from '@nestjs/common';
import { AccessRequestController } from './access-request.controller';
import { AccessRequestService } from './access-request.service';

@Module({
  controllers: [AccessRequestController],
  providers: [AccessRequestService],
  exports: [AccessRequestService],
})
export class AccessRequestModule {}
