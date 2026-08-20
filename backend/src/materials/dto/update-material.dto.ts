import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { UNIT_VALUES } from './create-material.dto';

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Наименование не может быть пустым' })
  name?: string;

  @IsOptional()
  @IsString()
  article?: string;

  @IsOptional()
  @IsIn(UNIT_VALUES, { message: 'Некорректная единица измерения' })
  unit?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Количество должно быть числом' })
  @Min(0, { message: 'Количество не может быть отрицательным' })
  specQuantity?: number;

  @IsOptional()
  @IsString()
  note?: string;
}