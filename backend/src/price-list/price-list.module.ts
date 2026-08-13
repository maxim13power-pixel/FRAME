import { Module } from '@nestjs/common';
import { PriceListController } from './price-list.controller';
import { PriceListService } from './price-list.service';

@Module({
  controllers: [PriceListController],
  providers: [PriceListService],
})
export class PriceListModule {}