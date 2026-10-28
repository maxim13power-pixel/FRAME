// backend/src/access-request/dto/create-access-request.dto.ts
// ⭐ №178: заявка на право создавать проекты в объекте
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccessRequestKind } from '@prisma/client';

export class CreateAccessRequestDto {
  // Пока один вид заявки; поле оставлено для расширения (например, «доступ к ценам»)
  @IsOptional()
  @IsEnum(AccessRequestKind, { message: 'kind: неизвестный вид заявки' })
  kind?: AccessRequestKind;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Комментарий не более 1000 символов' })
  comment?: string;
}
