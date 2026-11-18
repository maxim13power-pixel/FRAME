// backend/src/projects/dto/copy-project.dto.ts
// ⭐ №307: копия проекта внутри того же объекта (кнопка «Копировать проект»).
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Всё необязательное: без параметров получается «X (копия)» с датами и заметкой
 * оригинала, смета переносится БЕЗ факта (расход/прогресс = 0).
 */
export class CopyProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Название проекта: не более 200 символов' })
  name?: string;

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

  /** Перенести фактический расход, прогресс и последнюю фиксацию. */
  @IsOptional()
  @IsBoolean()
  copyFacts?: boolean;
}
