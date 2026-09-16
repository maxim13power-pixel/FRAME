// backend/src/rentals/rentals.module.ts
// ⭐ Раздел «Аренда»: модуль личного учёта арендованного оборудования
import { Module } from '@nestjs/common';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // @Global, но импортируем как в change — для единообразия
  controllers: [RentalsController],
  providers: [RentalsService],
  exports: [RentalsService], // на будущее (например, для дашборда)
})
export class RentalsModule {}