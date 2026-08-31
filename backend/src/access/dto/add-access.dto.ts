// backend/src/access/dto/add-access.dto.ts
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class AddAccessDto {
  // ⭐ Кого приглашаем: либо по userId (если фронт нашёл юзера), либо по email/телефону
  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

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
}