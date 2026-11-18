// backend/src/access/dto/add-access.dto.ts
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class AddAccessDto {
  // ⭐ №304: выдаём доступ только конкретному пользователю (по userId).
  // Приглашение «по email/телефону» убрано: люди делятся ссылкой в мессенджере.
  @IsInt()
  @Min(1)
  userId!: number;

  // ⭐ Роль приглашённого
  @IsIn(['CUSTOMER', 'FOREMAN', 'VIEWER'], {
    message: 'Роль должна быть CUSTOMER, FOREMAN или VIEWER',
  })
  role!: 'CUSTOMER' | 'FOREMAN' | 'VIEWER';

  // ⭐ projectId = null → на весь объект; конкретный id → только к этому проекту
  @IsOptional()
  @IsInt()
  @Min(1)
  projectId?: number;

  // ⭐ №207: право создавать проекты в объекте (только для FOREMAN и только
  // при доступе на весь объект). Администратор объекта умеет это и так.
  @IsOptional()
  @IsBoolean()
  canCreateProjects?: boolean;

  // ⭐ №182: делегирование «скрыть цены» (true — участник не видит деньги)
  @IsOptional()
  @IsBoolean()
  hidePrices?: boolean;
}
