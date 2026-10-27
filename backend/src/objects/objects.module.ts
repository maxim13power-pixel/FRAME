import { Module } from '@nestjs/common';
import { ObjectsService } from './objects.service';
import { ObjectsController } from './objects.controller';
import { PrismaModule } from '../prisma/prisma.module'; // путь может отличаться

@Module({
  imports: [PrismaModule], // обязательно!
  controllers: [ObjectsController],
  providers: [ObjectsService],
  // ⭐ №175: ObjectTemplatesService переиспользует создание объекта (доступ создателя)
  exports: [ObjectsService],
})
export class ObjectsModule {}
