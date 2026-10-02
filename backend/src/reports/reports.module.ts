// backend/src/reports/reports.module.ts
// ⭐ Раздел «Отчёты»: сметы и акты выполненных работ.
import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportPdfService } from './pdf.service';
import { ReportXlsxService } from './xlsx.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportPdfService, ReportXlsxService],
  exports: [ReportsService],
})
export class ReportsModule {}
