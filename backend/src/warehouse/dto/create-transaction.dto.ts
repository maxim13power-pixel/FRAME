// backend/src/warehouse/dto/create-transaction.dto.ts
// ⭐ Склад: DTO операции (приход/расход/списание).
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  @IsInt({ message: 'warehouseItemId: целое число' })
  @Min(1, { message: 'warehouseItemId: больше 0' })
  warehouseItemId!: number;

  @IsIn(['income', 'expense', 'write-off'], {
    message: 'type: income / expense / write-off',
  })
  type!: string;

  @IsNumber({}, { message: 'quantity: обязательное число' })
  @Min(0, { message: 'quantity: не меньше 0' })
  quantity!: number;

  @IsOptional()
  @IsNumber({}, { message: 'price: число или ничего' })
  @Min(0, { message: 'price: не меньше 0' })
  price?: number;

  @IsOptional()
  @IsInt({ message: 'projectId: целое число или ничего' })
  @Min(1, { message: 'projectId: больше 0' })
  projectId?: number;

  @IsOptional()
  @IsString({ message: 'comment: строка или ничего' })
  @MaxLength(500, { message: 'comment: максимум 500 символов' })
  comment?: string;
}
