import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export const UNIT_VALUES = [
  'PIECE',
  'METER',
  'LINEAR_METER',
  'SQUARE_METER',
  'CUBIC_METER',
  'KILOGRAM',
  'LITER',
  'TON',
  'BAG',
  'PACKAGE',
  'SET',
];

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty({ message: 'Наименование обязательно' })
  name!: string;

  @IsOptional()
  @IsString()
  article?: string;

  @IsOptional()
  @IsIn(UNIT_VALUES, { message: 'Некорректная единица измерения' })
  unit?: string;

  @IsNumber({}, { message: 'Кол-во по спецификации должно быть числом' })
  @Min(0, { message: 'Кол-во не может быть отрицательным' })
  specQuantity!: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsInt({ message: 'priceItemId должен быть целым числом' })
  priceItemId?: number;

  @IsOptional()
  @IsInt({ message: 'materialItemId должен быть целым числом' })
  materialItemId?: number;

  // ⭐ №271: inline-цены из формы сметы. Если переданы — позиция автоматически
  // добавляется/обновляется в справочнике проекта; отдельная модалка расценки не нужна.
  @IsOptional()
  @IsNumber({}, { message: 'workPrice должен быть числом' })
  @Min(0, { message: 'Цена работы не может быть отрицательной' })
  workPrice?: number;

  @IsOptional()
  @IsNumber({}, { message: 'materialPrice должен быть числом' })
  @Min(0, { message: 'Цена материала не может быть отрицательной' })
  materialPrice?: number;

  @IsInt({ message: 'projectId должен быть целым числом' })
  projectId!: number;
}
