// backend/src/materials/dto/bulk-ids.dto.ts
// ⭐ №292: массовые операции над строками сметы (выделил чекбоксами → дублировать/удалить).
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, Min } from 'class-validator';

export class BulkIdsDto {
  @IsArray({ message: 'ids должен быть массивом' })
  @ArrayNotEmpty({ message: 'Не выбрано ни одной строки' })
  @ArrayMaxSize(500, { message: 'За один раз можно обработать не более 500 строк' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'ids должны быть числами' })
  @Min(1, { each: true })
  ids!: number[];
}
