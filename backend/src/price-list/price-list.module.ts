import { Module } from '@nestjs/common';
import { PriceListController } from './price-list.controller';
import { PriceListService } from './price-list.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PriceListController],
  providers: [PriceListService],
  // ⭐ №273: импорт прайса проверяет права через общий сервис справочников
  exports: [PriceListService],
})
export class PriceListModule {}
