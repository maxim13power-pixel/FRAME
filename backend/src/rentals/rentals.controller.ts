// backend/src/rentals/rentals.controller.ts
// ⭐ Раздел «Аренда»: CRUD личного оборудования пользователя.
// userId берём из req.user.userId (JWT), проверка владения — в сервисе.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RentalsService } from './rentals.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import { ExtendRentalDto } from './dto/extend-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';

@Controller('rentals')
@UseGuards(JwtAuthGuard)
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  // ⭐ Список аренд текущего пользователя
  @Get()
  list(@Req() req) {
    return this.rentalsService.list(req.user.userId);
  }

  // ⭐ Создать аренду
  @Post()
  create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: CreateRentalDto,
    @Req() req,
  ) {
    return this.rentalsService.create(req.user.userId, dto);
  }

  // ⭐ Продлить аренду (новая дата + цена продления)
  @Patch(':id/extend')
  extend(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: ExtendRentalDto,
    @Req() req,
  ) {
    return this.rentalsService.extend(req.user.userId, id, dto);
  }

  // ⭐ Редактировать аренду (name/location/responsible/даты/note)
  // ВАЖНО: маршрут объявлен ПОСЛЕ PATCH ':id/extend', чтобы NestJS корректно разрулил роутинг
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateRentalDto,
    @Req() req,
  ) {
    return this.rentalsService.update(req.user.userId, id, dto);
  }

  // ⭐ Удалить аренду
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.rentalsService.remove(req.user.userId, id);
  }
}