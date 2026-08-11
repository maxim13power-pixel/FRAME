import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export const UNIT_VALUES = [
  'PIECE', 'METER', 'SQUARE_METER', 'CUBIC_METER', 'KILOGRAM',
  'LITER', 'TON', 'BAG', 'PACKAGE', 'SET',
];

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty({ message: 'Наименование обязательно' })
  name: string;

  @IsOptional()
  @IsString()
  article?: string;

  @IsOptional()
  @IsIn(UNIT_VALUES, { message: 'Некорректная единица измерения' })
  unit?: string;

  @IsNumber({}, { message: 'Кол-во по спецификации должно быть числом' })
  @Min(0, { message: 'Кол-во не может быть отрицательным' })
  specQuantity: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsInt({ message: 'projectId должен быть целым числом' })
  projectId: number;
}