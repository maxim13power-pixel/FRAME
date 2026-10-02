// backend/src/reports/dto/update-report-item.dto.ts
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateReportItemDto {
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

  @IsOptional()
  @IsNumber({}, { message: 'quantity: число или ничего' })
  @Min(0, { message: 'quantity: не меньше 0' })
  quantity?: number;

  @IsOptional()
  @IsNumber({}, { message: 'price: число или ничего' })
  @Min(0, { message: 'price: не меньше 0' })
  price?: number;

  @IsOptional()
  @IsNumber({}, { message: 'total: число или ничего' })
  @Min(0, { message: 'total: не меньше 0' })
  total?: number;
}
