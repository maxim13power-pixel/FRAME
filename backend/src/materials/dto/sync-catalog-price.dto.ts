// backend/src/materials/dto/sync-catalog-price.dto.ts
// ⭐ №302: «изменить цену и в справочнике» для строки, которая ещё не привязана к расценке.
import { Type } from 'class-transformer';
import { IsIn, IsNumber, Min } from 'class-validator';

export class SyncCatalogPriceDto {
  /** Какую цену строки меняем: работу или материал — механика одна. */
  @IsIn(['work', 'material'], { message: 'side должен быть work или material' })
  side!: 'work' | 'material';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Цена должна быть числом' })
  @Min(0, { message: 'Цена не может быть отрицательной' })
  price!: number;
}
