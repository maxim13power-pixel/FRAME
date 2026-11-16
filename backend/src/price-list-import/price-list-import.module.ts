// backend/src/price-list-import/price-list-import.module.ts
// ⭐ №273 (§121): импорт/выгрузка прайс-листа и уточнение единиц.
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PriceListModule } from '../price-list/price-list.module';
import { PriceListImportController } from './price-list-import.controller';
import { PriceListImportService } from './price-list-import.service';
import { PriceTemplateService } from './price-template.service';

@Module({
  imports: [PrismaModule, PriceListModule],
  controllers: [PriceListImportController],
  providers: [PriceListImportService, PriceTemplateService],
})
export class PriceListImportModule {}
