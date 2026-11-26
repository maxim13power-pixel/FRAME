import { Module } from '@nestjs/common';
import { ObjectsService } from './objects.service';
import { ObjectsController } from './objects.controller';
import { ObjectDeletionService } from './object-deletion.service';
import { ObjectCopyService } from './object-copy.service';
import { PrismaModule } from '../prisma/prisma.module'; // путь может отличаться
import { BillingModule } from '../billing/billing.module'; // ⭐ №407: лимиты тарифа

@Module({
  imports: [PrismaModule, BillingModule], // обязательно!
  controllers: [ObjectsController],
  providers: [ObjectsService, ObjectDeletionService, ObjectCopyService],
  exports: [ObjectsService, ObjectDeletionService],
})
export class ObjectsModule {}
