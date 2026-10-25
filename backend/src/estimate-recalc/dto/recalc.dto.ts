// backend/src/estimate-recalc/dto/recalc.dto.ts
import { IsInt, IsOptional } from 'class-validator';

// ⭐ №170: пересчёт сметы по справочнику.
// catalogId необязателен: по умолчанию берём действующий справочник проекта
// (свой проекта → справочник объекта, см. §14).
export class RecalcDto {
  @IsOptional()
  @IsInt({ message: 'catalogId должен быть целым числом' })
  catalogId?: number;
}
