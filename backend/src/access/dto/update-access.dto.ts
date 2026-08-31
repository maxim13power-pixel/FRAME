// backend/src/access/dto/update-access.dto.ts
import { IsIn } from 'class-validator';

export class UpdateAccessDto {
  @IsIn(['CUSTOMER', 'FOREMAN', 'VIEWER'], {
    message: 'Роль должна быть CUSTOMER, FOREMAN или VIEWER',
  })
  role!: 'CUSTOMER' | 'FOREMAN' | 'VIEWER';
}