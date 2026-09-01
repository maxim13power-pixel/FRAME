import { Module } from '@nestjs/common';
import { PriceListController } from './price-list.controller';
import { PriceListService } from './price-list.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
imports: [PrismaModule],
controllers: [PriceListController],
providers: [PriceListService],
})
export class PriceListModule {}