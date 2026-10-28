// backend/src/access/dto/update-access.dto.ts
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateAccessDto {
  // ⭐ №168: роль и права менеджера можно менять по отдельности
  @IsOptional()
  @IsIn(['CUSTOMER', 'FOREMAN', 'VIEWER'], {
    message: 'Роль должна быть CUSTOMER, FOREMAN или VIEWER',
  })
  role?: 'CUSTOMER' | 'FOREMAN' | 'VIEWER';

  // ⭐ №168: «управляет командой» — только для FOREMAN, выдаёт администратор объекта
  @IsOptional()
  @IsBoolean()
  isManager?: boolean;

  // ⭐ №182: показать/скрыть цены участнику
  @IsOptional()
  @IsBoolean()
  hidePrices?: boolean;
}
