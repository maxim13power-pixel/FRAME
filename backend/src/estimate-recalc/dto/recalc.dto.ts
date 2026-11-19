// backend/src/estimate-recalc/dto/recalc.dto.ts
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

// ⭐ №170: пересчёт сметы по справочнику.
// catalogId необязателен: по умолчанию берём действующий справочник проекта
// (свой проекта → справочник объекта, см. §14).
// ⭐ №337: наценка/скидка в процентах отдельно для работ и материалов
// (как при копировании объекта: −100…+1000 %).
export class RecalcDto {
  @IsOptional()
  @IsInt({ message: 'catalogId должен быть целым числом' })
  catalogId?: number;

  @IsOptional()
  @IsNumber({}, { message: 'workMarkupPercent должен быть числом' })
  @Min(-100, { message: 'Скидка не может быть больше 100 %' })
  @Max(1000, { message: 'Наценка не может быть больше 1000 %' })
  workMarkupPercent?: number;

  @IsOptional()
  @IsNumber({}, { message: 'materialMarkupPercent должен быть числом' })
  @Min(-100, { message: 'Скидка не может быть больше 100 %' })
  @Max(1000, { message: 'Наценка не может быть больше 1000 %' })
  materialMarkupPercent?: number;
}
