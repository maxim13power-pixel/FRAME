// backend/src/rentals/dto/update-rental.dto.ts
// ⭐ Раздел «Аренда»: DTO редактирования аренды (все поля опциональны).
// ⭐ ВАЖНО: price и totalSpent здесь НЕТ — финансовая история не редактируется руками
// (totalSpent растёт только через продления).
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateRentalDto {
  @IsOptional()
  @IsString({ message: 'name: строка или ничего' })
  @MinLength(1, { message: 'name: минимум 1 символ' })
  @MaxLength(200, { message: 'name: максимум 200 символов' })
  name?: string;

  // ⭐ №368: цену можно исправить (totalSpent пересчитается на разницу)
  @IsOptional()
  @IsNumber({}, { message: 'price: обязательное число' })
  @Min(0, { message: 'price: число не меньше 0' })
  @Max(1000000000, { message: 'price: слишком большая сумма' })
  price?: number;

  @IsOptional()
  @IsString({ message: 'location: строка или ничего' })
  @MaxLength(200, { message: 'location: максимум 200 символов' })
  location?: string;

  @IsOptional()
  @IsString({ message: 'responsible: строка или ничего' })
  @MaxLength(200, { message: 'responsible: максимум 200 символов' })
  responsible?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'startDate: ISO-дата или ничего' })
  startDate?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'endDate: ISO-дата или ничего' })
  endDate?: string;

  @IsOptional()
  @IsString({ message: 'note: строка или ничего' })
  @MaxLength(500, { message: 'note: максимум 500 символов' })
  note?: string;
}
