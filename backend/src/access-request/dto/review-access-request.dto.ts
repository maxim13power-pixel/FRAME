// backend/src/access-request/dto/review-access-request.dto.ts
// ⭐ №178: комментарий при одобрении/отклонении заявки
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewAccessRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Комментарий не более 1000 символов' })
  comment?: string;
}
