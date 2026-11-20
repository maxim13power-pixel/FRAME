// backend/src/access/dto/update-access.dto.ts
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateAccessDto {
  // ⭐ №351: администратор объекта меняет роль, право создавать проекты
  // и видимость цен — он «админ, а не хрен с горы» (решение владельца).
  @IsOptional()
  @IsIn(['CUSTOMER', 'FOREMAN', 'VIEWER'], {
    message: 'Роль должна быть CUSTOMER, FOREMAN или VIEWER',
  })
  role?: 'CUSTOMER' | 'FOREMAN' | 'VIEWER';

  // ⭐ №207: право создавать проекты в объекте (только для FOREMAN)
  @IsOptional()
  @IsBoolean()
  canCreateProjects?: boolean;

  // ⭐ №351: видимость цен теперь можно менять после приглашения
  @IsOptional()
  @IsBoolean()
  hidePrices?: boolean;
}
