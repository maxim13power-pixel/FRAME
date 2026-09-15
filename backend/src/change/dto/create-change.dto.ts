// backend/src/change/dto/create-change.dto.ts
// ⭐ P0-6: DTO создания заявки на изменение.
// ВАЖНО: в схеме ChangeRequest.type — String, поэтому enum ЛОКАЛЬНЫЙ,
// НЕ из @prisma/client (там его нет).
import { IsEnum, IsInt, IsObject, IsOptional } from 'class-validator';

export enum ChangeTypeEnum {
  ADD_ROW = 'ADD_ROW', // новая строка сметы
  CHANGE_QTY = 'CHANGE_QTY', // изменить количество
  CHANGE_PRICE = 'CHANGE_PRICE', // изменить цену
}

export class CreateChangeDto {
  @IsInt({ message: 'projectId: обязательное целое число' })
  projectId!: number;

  @IsOptional()
  @IsInt({ message: 'materialId: целое число или ничего' })
  materialId?: number;

  @IsEnum(ChangeTypeEnum, {
    message: 'type: ADD_ROW, CHANGE_QTY или CHANGE_PRICE',
  })
  type!: ChangeTypeEnum;

  @IsObject({ message: 'payload: обязателен (JSON с данными изменения)' })
  payload!: Record<string, any>;
}
