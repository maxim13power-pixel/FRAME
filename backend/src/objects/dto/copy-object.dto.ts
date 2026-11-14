import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export type ObjectCopyPricingMode = 'keep' | 'existing' | 'copy';

/**
 * ⭐ Копирование объекта целиком.
 *
 * Две независимые оси:
 *  • copyFacts — переносить ли фактический расход/прогресс;
 *  • pricingMode — оставить цены или пересчитать по справочнику
 *    (включая создание копии справочника с наценкой).
 *
 * При pricingMode='existing'/'copy' пересчитываются ВСЕ строки, включая строки
 * с фактическим расходом: это осознанное создание копии по новым ценам.
 */
export class CopyObjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Название объекта: не более 200 символов' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Адрес: не более 500 символов' })
  address?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Дата начала имеет неверный формат' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Дата окончания имеет неверный формат' })
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Заметка не более 1000 символов' })
  note?: string;

  /** Если не передан — копируются все проекты объекта. Пустой массив — ни одного. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true, message: 'projectIds должен содержать целые числа' })
  projectIds?: number[];

  /** Перенести фактический расход, прогресс и последнюю фиксацию. */
  @IsOptional()
  @IsBoolean()
  copyFacts?: boolean;

  @IsIn(['keep', 'existing', 'copy'], {
    message: 'pricingMode: ожидается keep, existing или copy',
  })
  pricingMode!: ObjectCopyPricingMode;

  /** Для pricingMode='existing' — существующий справочник. */
  @IsOptional()
  @IsInt({ message: 'catalogId должен быть целым числом' })
  catalogId?: number;

  /** Для pricingMode='copy' — исходный справочник (по умолчанию справочник объекта). */
  @IsOptional()
  @IsInt({ message: 'sourceCatalogId должен быть целым числом' })
  sourceCatalogId?: number;

  /** Для pricingMode='copy' — название новой копии справочника. */
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Название справочника: не более 80 символов' })
  catalogName?: string;

  /** Наценка на работы, %. Отрицательное значение — скидка. */
  @IsOptional()
  @IsNumber({}, { message: 'workMarkupPercent должен быть числом' })
  @Min(-90, { message: 'Наценка на работы не ниже -90%' })
  @Max(500, { message: 'Наценка на работы не выше 500%' })
  workMarkupPercent?: number;

  /** Наценка на материалы, %. Отрицательное значение — скидка. */
  @IsOptional()
  @IsNumber({}, { message: 'materialMarkupPercent должен быть числом' })
  @Min(-90, { message: 'Наценка на материалы не ниже -90%' })
  @Max(500, { message: 'Наценка на материалы не выше 500%' })
  materialMarkupPercent?: number;

  /** Требовать полное соответствие строк сметы справочнику (по умолчанию да). */
  @IsOptional()
  @IsBoolean()
  strictMatch?: boolean;
}
