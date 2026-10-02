// backend/src/reports/dto/add-report-item.dto.ts
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AddReportItemDto {
  @IsOptional()
  @IsInt({ message: 'materialId: целое число или ничего' })
  @Min(1, { message: 'materialId: больше 0' })
  materialId?: number;

  @IsOptional()
  @IsString({ message: 'name: строка или ничего' })
  @MinLength(1, { message: 'name: минимум 1 символ' })
  @MaxLength(300, { message: 'name: максимум 300 символов' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'unit: строка или ничего' })
  @MaxLength(50, { message: 'unit: максимум 50 символов' })
  unit?: string;

  @IsNumber({}, { message: 'quantity: обязательное число' })
  @Min(0, { message: 'quantity: не меньше 0' })
  quantity!: number;

  @IsOptional()
  @IsNumber({}, { message: 'price: число или ничего' })
  @Min(0, { message: 'price: не меньше 0' })
  price?: number;
}
