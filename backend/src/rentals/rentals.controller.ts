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
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RentalsService } from './rentals.service';
import type { RentalStatusFilter } from './rentals.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import { ExtendRentalDto } from './dto/extend-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';

interface AuthedRequest {
  user: { userId: number };
}

@Controller('rentals')
@UseGuards(JwtAuthGuard)
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  // ⭐ Список аренд текущего пользователя: ?status=active|closed|all
  @Get()
  list(@Req() req: AuthedRequest, @Query('status') status?: string) {
    const parsed: RentalStatusFilter =
      status === 'closed' || status === 'all' ? status : 'active';
    return this.rentalsService.list(req.user.userId, parsed);
  }

  // ⭐ Создать аренду
  @Post()
  create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: CreateRentalDto,
    @Req() req: AuthedRequest,
  ) {
    return this.rentalsService.create(req.user.userId, dto);
  }

  // ⭐ Продлить аренду (новая дата + цена продления)
  @Patch(':id/extend')
  extend(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: ExtendRentalDto,
    @Req() req: AuthedRequest,
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
    @Req() req: AuthedRequest,
  ) {
    return this.rentalsService.update(req.user.userId, id, dto);
  }

  // ⭐ №368: завершить аренду (в «Активных» больше не показывается)
  @Post(':id/close')
  close(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.rentalsService.close(req.user.userId, id);
  }

  // ⭐ №368: вернуть завершённую аренду в работу
  @Post(':id/reopen')
  reopen(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.rentalsService.reopen(req.user.userId, id);
  }

  // ⭐ Удалить аренду
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.rentalsService.remove(req.user.userId, id);
  }
}
