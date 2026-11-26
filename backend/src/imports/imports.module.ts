// backend/src/imports/imports.module.ts
// ⭐ №202: импорт сметы из Excel (партия + предпросмотр + commit).
import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { EstimateParserService } from './estimate-parser.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module'; // ⭐ №408: лимит строк

@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [ImportsController],
  providers: [ImportsService, EstimateParserService],
})
export class ImportsModule {}
