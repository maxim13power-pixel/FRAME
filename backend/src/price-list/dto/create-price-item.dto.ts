import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { UNIT_VALUES } from '../../materials/dto/create-material.dto';

export class CreatePriceItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Наименование обязательно' })
  name!: string;

  @IsOptional()
  @IsString()
  article?: string;

  @IsOptional()
  @IsIn(UNIT_VALUES, { message: 'Некорректная единица измерения' })
  unit?: string;

  @IsNumber({}, { message: 'Цена должна быть числом' })
  @Min(0, { message: 'Цена не может быть отрицательной' })
  price!: number;

  @IsInt({ message: 'categoryId должен быть целым числом' })
  categoryId!: number;
}