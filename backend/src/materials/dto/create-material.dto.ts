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
  @IsInt({ message: 'projectId должен быть целым числом' })
  projectId!: number;

  // ⭐ №318: норма расхода материала на 1 единицу строки (в единицах упаковки).
  // Нужна, когда материал продаётся упаковкой: краска 9 кг, мешок 25 кг.
  @IsOptional()
  @IsNumber({}, { message: 'consumption должен быть числом' })
  @Min(0, { message: 'Расход не может быть отрицательным' })
  consumption?: number | null;

  // ⭐ №321: «сколько единиц в упаковке» — задаётся прямо из сметы калькулятором
  // «от объёма» (мешок 25 кг, рулон 100 м²). Пишется в расценку справочника.
  @IsOptional()
  @IsNumber({}, { message: 'materialPackSize должен быть числом' })
  @Min(0, { message: 'Упаковка не может быть отрицательной' })
  materialPackSize?: number | null;
}
