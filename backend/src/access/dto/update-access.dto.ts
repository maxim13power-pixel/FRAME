// backend/src/access/dto/update-access.dto.ts
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateAccessDto {
  // ⭐ №207: меняются роль и право создавать проекты.
  // hidePrices здесь больше НЕТ: видимость цен фиксируется при приглашении.
  @IsOptional()
  @IsIn(['CUSTOMER', 'FOREMAN', 'VIEWER'], {
    message: 'Роль должна быть CUSTOMER, FOREMAN или VIEWER',
  })
  role?: 'CUSTOMER' | 'FOREMAN' | 'VIEWER';

  // ⭐ №207: право создавать проекты в объекте (только для FOREMAN)
  @IsOptional()
  @IsBoolean()
  canCreateProjects?: boolean;
}
