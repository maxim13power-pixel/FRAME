// backend/src/warehouse/warehouse.controller.ts
// ⭐ Раздел «Склад»: позиции + операции (приход/расход/списание).
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
import { WarehouseService } from './warehouse.service';
import { CreateWarehouseItemDto } from './dto/create-warehouse-item.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateWarehouseItemDto } from './dto/update-warehouse-item.dto';

@Controller('warehouse')
@UseGuards(JwtAuthGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get('items')
  list(
    @Req() req,
    @Query('objectId') objectId?: string,
    @Query('search') search?: string,
  ) {
    const oid = objectId === undefined || objectId === '' ? undefined : Number(objectId);
    return this.warehouseService.list(req.user.userId, oid, search);
  }

  @Get('items/:id')
  detail(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.warehouseService.detail(req.user.userId, id);
  }

  @Post('items')
  create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: CreateWarehouseItemDto,
    @Req() req,
  ) {
    return this.warehouseService.create(req.user.userId, dto);
  }

  @Patch('items/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateWarehouseItemDto,
    @Req() req,
  ) {
    return this.warehouseService.update(req.user.userId, id, dto);
  }

  @Delete('items/:id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.warehouseService.remove(req.user.userId, id);
  }

  @Post('transactions')
  createTransaction(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: CreateTransactionDto,
    @Req() req,
  ) {
    return this.warehouseService.createTransaction(req.user.userId, dto);
  }

  @Get('transactions')
  listTransactions(@Req() req, @Query('itemId') itemId?: string) {
    const iid = itemId === undefined || itemId === '' ? undefined : Number(itemId);
    return this.warehouseService.listTransactions(req.user.userId, iid);
  }
}
