// backend/src/rentals/rentals.service.ts
// ⭐ Раздел «Аренда»: личное оборудование ПОЛЬЗОВАТЕЛЯ (userId из JWT).
// Никаких ролей/ObjectAccess/объектов — владелец = автор запроса.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import { ExtendRentalDto } from './dto/extend-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';

@Injectable()
export class RentalsService {
  constructor(private prisma: PrismaService) {}

  // ─── Все аренды юзера, ближайшие по endDate сверху ───
  async list(userId: number) {
    return this.prisma.rental.findMany({
      where: { userId },
      orderBy: { endDate: 'asc' },
    });
  }

  // ─── Создать аренду (totalSpent = price) ───
  async create(userId: number, dto: CreateRentalDto) {
    return this.prisma.rental.create({
      data: {
        userId,
        name: dto.name.trim(),
        location: dto.location?.trim() || null,
        responsible: dto.responsible?.trim() || null,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        price: dto.price,
        totalSpent: dto.price, // ⭐ при создании потрачено = цене аренды
        note: dto.note?.trim() || null,
      },
    });
  }

  // ─── Продлить аренду: endDate = newEndDate, totalSpent += price ───
  async extend(userId: number, id: number, dto: ExtendRentalDto) {
    // ⭐ Проверка владения: 404 вместо 403 — не раскрываем существование чужих записей
    const rental = await this.prisma.rental.findFirst({
      where: { id, userId },
    });
    if (!rental) {
      throw new NotFoundException('Аренда не найдена');
    }
    if (new Date(dto.newEndDate).getTime() <= rental.endDate.getTime()) {
      throw new BadRequestException(
        'newEndDate: должна быть строго больше текущей даты окончания',
      );
    }
    // ⭐ $transaction: атомарно двигаем дату и наращиваем сумму
    return this.prisma.$transaction(async (tx) => {
      return tx.rental.update({
        where: { id: rental.id },
        data: {
          endDate: new Date(dto.newEndDate),
          totalSpent: { increment: dto.price },
        },
      });
    });
  }

  // ─── Редактировать аренду (name/location/responsible/даты/note) ───
  async update(userId: number, id: number, dto: UpdateRentalDto) {
    // ⭐ Проверка владения: 404 вместо 403 — не раскрываем существование чужих записей
    const rental = await this.prisma.rental.findFirst({
      where: { id, userId },
    });
    if (!rental) {
      throw new NotFoundException('Аренда не найдена');
    }

    // ⭐ Мердж дат: если передана только одна — вторая берётся из записи
    const start = dto.startDate ? new Date(dto.startDate) : rental.startDate;
    const end = dto.endDate ? new Date(dto.endDate) : rental.endDate;
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('endDate: не может быть раньше startDate');
    }

    return this.prisma.rental.update({
      where: { id: rental.id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        location: dto.location !== undefined ? dto.location.trim() || null : undefined,
        responsible:
          dto.responsible !== undefined ? dto.responsible.trim() || null : undefined,
        startDate: dto.startDate ? start : undefined,
        endDate: dto.endDate ? end : undefined,
        note: dto.note !== undefined ? dto.note.trim() || null : undefined,
        // ⭐ price и totalSpent НЕ ТРОГАЕМ — финансовая история («всего потрачено»)
      },
    });
  }

  // ─── Удалить аренду (только свою) ───
  async remove(userId: number, id: number) {
    const rental = await this.prisma.rental.findFirst({
      where: { id, userId },
    });
    if (!rental) {
      throw new NotFoundException('Аренда не найдена');
    }
    await this.prisma.rental.delete({ where: { id: rental.id } });
    return { success: true };
  }
}