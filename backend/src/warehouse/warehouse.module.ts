// backend/src/warehouse/warehouse.module.ts
// ⭐ Раздел «Склад»: модуль учёта материалов/оборудования
import { Module } from '@nestjs/common';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // @Global, но импортируем для единообразия
  controllers: [WarehouseController],
  providers: [WarehouseService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
