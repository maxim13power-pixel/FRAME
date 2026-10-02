// backend/src/brigades/dto/add-member.dto.ts
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AddMemberDto {
  @IsString({ message: 'fullName: обязательная строка' })
  @MinLength(1, { message: 'fullName: минимум 1 символ' })
  @MaxLength(200, { message: 'fullName: максимум 200 символов' })
  fullName!: string;

  @IsOptional()
  @IsString({ message: 'role: строка или ничего' })
  @MaxLength(50, { message: 'role: максимум 50 символов' })
  role?: string;

  @IsOptional()
  @IsString({ message: 'phone: строка или ничего' })
  @MaxLength(50, { message: 'phone: максимум 50 символов' })
  phone?: string;
}
