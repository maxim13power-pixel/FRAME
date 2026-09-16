// backend/src/rentals/dto/update-rental.dto.ts
// ⭐ Раздел «Аренда»: DTO редактирования аренды (все поля опциональны).
// ⭐ ВАЖНО: price и totalSpent здесь НЕТ — финансовая история не редактируется руками
// (totalSpent растёт только через продления).
import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateRentalDto {
  @IsOptional()
  @IsString({ message: 'name: строка или ничего' })
  @MinLength(1, { message: 'name: минимум 1 символ' })
  @MaxLength(200, { message: 'name: максимум 200 символов' })
  name?: string;

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
