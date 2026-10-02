// backend/src/reports/reports.controller.ts
// ⭐ Раздел «Отчёты»: сметы и акты выполненных работ (CRUD, без экспорта).
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { AddReportItemDto } from './dto/add-report-item.dto';
import { UpdateReportItemDto } from './dto/update-report-item.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  list(
    @Req() req,
    @Query('projectId') projectId?: string,
    @Query('objectId') objectId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.reportsService.list(req.user.userId, {
      projectId: projectId ? Number(projectId) : undefined,
      objectId: objectId ? Number(objectId) : undefined,
      type,
      status,
    });
  }

  @Get(':id')
  detail(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.reportsService.detail(req.user.userId, id);
  }

  @Post()
  create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: CreateReportDto,
    @Req() req,
  ) {
    return this.reportsService.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateReportDto,
    @Req() req,
  ) {
    return this.reportsService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.reportsService.remove(req.user.userId, id);
  }

  @Post(':id/items')
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: AddReportItemDto,
    @Req() req,
  ) {
    return this.reportsService.addItem(req.user.userId, id, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateReportItemDto,
    @Req() req,
  ) {
    return this.reportsService.updateItem(req.user.userId, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req,
  ) {
    return this.reportsService.removeItem(req.user.userId, id, itemId);
  }
}
