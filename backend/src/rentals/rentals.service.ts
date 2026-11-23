// backend/src/rentals/rentals.service.ts
// ⭐ Раздел «Аренда»: личное оборудование ПОЛЬЗОВАТЕЛЯ (userId из JWT).
// Никаких ролей/ObjectAccess/объектов — владелец = автор запроса.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRentalDto } from './dto/create-rental.dto';
import { ExtendRentalDto } from './dto/extend-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';

export type RentalStatusFilter = 'active' | 'closed' | 'all';

@Injectable()
export class RentalsService {
  constructor(private prisma: PrismaService) {}

  // ─── Все аренды юзера, ближайшие по endDate сверху ───
  async list(userId: number, status: RentalStatusFilter = 'active') {
    return this.prisma.rental.findMany({
      where: {
        userId,
        ...(status === 'active'
          ? { closedAt: null }
          : status === 'closed'
            ? { closedAt: { not: null } }
            : {}),
      },
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
    // ⭐ №374: блокируем строку и перепроверяем внутри транзакции —
    // два параллельных продления больше не теряют одно из начислений.
    return this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM rentals
        WHERE id = ${id} AND "userId" = ${userId}
        FOR UPDATE
      `;
      if (!locked) {
        throw new NotFoundException('Аренда не найдена');
      }
      const rental = await tx.rental.findFirstOrThrow({ where: { id } });
      if (new Date(dto.newEndDate).getTime() <= rental.endDate.getTime()) {
        throw new BadRequestException(
          'newEndDate: должна быть строго больше текущей даты окончания',
        );
      }
      // ⭐ №368: завершённую аренду не продлеваем — сначала вернуть в работу
      if (rental.closedAt) {
        throw new BadRequestException(
          'Аренда завершена — верните её в работу, чтобы продлить',
        );
      }
      return tx.rental.update({
        where: { id: rental.id },
        data: {
          endDate: new Date(dto.newEndDate),
          totalSpent: { increment: dto.price },
        },
      });
    });
  }

  // ─── Редактировать аренду (name/location/responsible/даты/note/price) ───
  async update(userId: number, id: number, dto: UpdateRentalDto) {
    // ⭐ №374: правка цены пересчитывает totalSpent — считаем под блокировкой,
    // иначе параллельное продление потеряется.
    return this.prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM rentals
        WHERE id = ${id} AND "userId" = ${userId}
        FOR UPDATE
      `;
      if (!locked) {
        throw new NotFoundException('Аренда не найдена');
      }
      const rental = await tx.rental.findFirstOrThrow({ where: { id } });

      // ⭐ Мердж дат: если передана только одна — вторая берётся из записи
      const start = dto.startDate ? new Date(dto.startDate) : rental.startDate;
      const end = dto.endDate ? new Date(dto.endDate) : rental.endDate;
      if (end.getTime() < start.getTime()) {
        throw new BadRequestException('endDate: не может быть раньше startDate');
      }

      return tx.rental.update({
        where: { id: rental.id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          location:
            dto.location !== undefined ? dto.location.trim() || null : undefined,
          responsible:
            dto.responsible !== undefined
              ? dto.responsible.trim() || null
              : undefined,
          startDate: dto.startDate ? start : undefined,
          endDate: dto.endDate ? end : undefined,
          note: dto.note !== undefined ? dto.note.trim() || null : undefined,
          // ⭐ №368: цену можно исправить — «всего потрачено» пересчитываем
          // на разницу (продления остаются учтёнными)
          ...(dto.price !== undefined
            ? {
                price: dto.price,
                totalSpent:
                  Math.round(
                    (Number(rental.totalSpent) +
                      dto.price -
                      Number(rental.price)) *
                      100,
                  ) / 100,
              }
            : {}),
        },
      });
    });
  }

  /** ⭐ №368: завершить аренду (в список «Активные» больше не попадает) */
  async close(userId: number, id: number) {
    const rental = await this.prisma.rental.findFirst({
      where: { id, userId },
    });
    if (!rental) {
      throw new NotFoundException('Аренда не найдена');
    }
    return this.prisma.rental.update({
      where: { id: rental.id },
      data: { closedAt: new Date() },
    });
  }

  /** ⭐ №368: вернуть завершённую аренду в работу */
  async reopen(userId: number, id: number) {
    const rental = await this.prisma.rental.findFirst({
      where: { id, userId },
    });
    if (!rental) {
      throw new NotFoundException('Аренда не найдена');
    }
    return this.prisma.rental.update({
      where: { id: rental.id },
      data: { closedAt: null },
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
