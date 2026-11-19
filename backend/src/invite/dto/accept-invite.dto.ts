// backend/src/invite/dto/accept-invite.dto.ts
import { IsBoolean, IsOptional } from 'class-validator';

// ⭐ №341: ссылка на объект может понизить роль (например, был «Прораб» в проекте,
// ссылка даёт «Наблюдателя»). Тогда страница принятия просит подтверждение.
export class AcceptInviteDto {
  @IsOptional()
  @IsBoolean({ message: 'confirmDowngrade должен быть true/false' })
  confirmDowngrade?: boolean;
}
