// backend/src/change/dto/review-change.dto.ts
// ⭐ P0-6: DTO согласования/отклонения заявки
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ReviewActionEnum {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewChangeDto {
  @IsEnum(ReviewActionEnum, { message: 'action: APPROVE или REJECT' })
  action!: ReviewActionEnum;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Комментарий максимум 500 символов' })
  reviewComment?: string;
}
