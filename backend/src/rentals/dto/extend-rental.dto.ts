// backend/src/rentals/dto/extend-rental.dto.ts
// ⭐ Раздел «Аренда»: DTO продления аренды.
// newEndDate строго больше текущей endDate — проверяется в сервисе (нужна БД).
import { IsISO8601, IsNumber, Min } from 'class-validator';

export class ExtendRentalDto {
  @IsISO8601({}, { message: 'newEndDate: обязательная ISO-дата' })
  newEndDate!: string;

  @IsNumber({}, { message: 'price: обязательное число' })
  @Min(0, { message: 'price: число не меньше 0' })
  price!: number;
}