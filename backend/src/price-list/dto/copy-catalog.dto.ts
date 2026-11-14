import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// ⭐ №164: «поделиться» справочником = скопировать расценки в справочник объекта/проекта
export class CopyCatalogDto {
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Название справочника: не более 80 символов' })
  name?: string;

  @IsOptional()
  @IsInt({ message: 'objectId должен быть целым числом' })
  objectId?: number;

  @IsOptional()
  @IsInt({ message: 'projectId должен быть целым числом' })
  projectId?: number;

  /** ⭐ Наценка на работы, %. Отрицательное значение — скидка. */
  @IsOptional()
  @IsNumber({}, { message: 'workMarkupPercent должен быть числом' })
  @Min(-90, { message: 'Наценка на работы не ниже -90%' })
  @Max(500, { message: 'Наценка на работы не выше 500%' })
  workMarkupPercent?: number;

  /** ⭐ Наценка на материалы, %. Отрицательное значение — скидка. */
  @IsOptional()
  @IsNumber({}, { message: 'materialMarkupPercent должен быть числом' })
  @Min(-90, { message: 'Наценка на материалы не ниже -90%' })
  @Max(500, { message: 'Наценка на материалы не выше 500%' })
  materialMarkupPercent?: number;
}
