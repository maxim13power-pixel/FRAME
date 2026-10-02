// backend/src/warehouse/dto/update-warehouse-item.dto.ts
// ⭐ Склад: DTO редактирования позиции (name/unit/category/comment — все опционально).
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateWarehouseItemDto {
  @IsOptional()
  @IsString({ message: 'name: строка или ничего' })
  @MinLength(1, { message: 'name: минимум 1 символ' })
  @MaxLength(200, { message: 'name: максимум 200 символов' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'unit: строка или ничего' })
  @MaxLength(50, { message: 'unit: максимум 50 символов' })
  unit?: string;

  @IsOptional()
  @IsString({ message: 'category: строка или ничего' })
  @MaxLength(100, { message: 'category: максимум 100 символов' })
  category?: string;

  @IsOptional()
  @IsString({ message: 'comment: строка или ничего' })
  @MaxLength(500, { message: 'comment: максимум 500 символов' })
  comment?: string;
}
