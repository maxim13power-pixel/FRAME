// backend/src/projects/dto/copy-estimate.dto.ts
// ⭐ №286: копирование сметы из другого проекта при создании нового.
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class CopyEstimateDto {
  /** Из какого проекта берём смету (должен быть виден пользователю). */
  @Type(() => Number)
  @IsInt({ message: 'sourceProjectId должен быть числом' })
  @Min(1, { message: 'sourceProjectId должен быть больше нуля' })
  sourceProjectId!: number;

  /**
   * true — количества не переносим (остаются названия и единицы, количество 0);
   * false/не задано — количества по спецификации копируются как есть.
   */
  @IsOptional()
  @IsBoolean()
  zeroQuantities?: boolean;

  /**
   * ⭐ №290: true — добавляем позиции в НЕПУСТУЮ смету (кнопка «Добавить из шаблона» в смете).
   * По умолчанию (создание проекта) копировать можно только в пустой проект — это защита
   * от случайного дубля при двойном клике.
   */
  @IsOptional()
  @IsBoolean()
  append?: boolean;
}
