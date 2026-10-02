// backend/src/warehouse/dto/create-warehouse-item.dto.ts
// ⭐ Склад: DTO создания позиции.
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateWarehouseItemDto {
  @IsString({ message: 'name: обязательная строка' })
  @MinLength(1, { message: 'name: минимум 1 символ' })
  @MaxLength(200, { message: 'name: максимум 200 символов' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'unit: строка или ничего' })
  @MaxLength(50, { message: 'unit: максимум 50 символов' })
  unit?: string;

  @IsOptional()
  @IsString({ message: 'category: строка или ничего' })
  @MaxLength(100, { message: 'category: максимум 100 символов' })
  category?: string;

  @IsOptional()
  @IsNumber({}, { message: 'quantity: число или ничего' })
  @Min(0, { message: 'quantity: не меньше 0' })
  quantity?: number;

  @IsOptional()
  @IsNumber({}, { message: 'price: число или ничего' })
  @Min(0, { message: 'price: не меньше 0' })
  price?: number;

  @IsOptional()
  @IsString({ message: 'comment: строка или ничего' })
  @MaxLength(500, { message: 'comment: максимум 500 символов' })
  comment?: string;

  @IsOptional()
  @IsInt({ message: 'objectId: целое число или ничего' })
  @Min(1, { message: 'objectId: больше 0' })
  objectId?: number;
}
