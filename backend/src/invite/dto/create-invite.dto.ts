import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { AccessRole } from '@prisma/client';

export class CreateInviteDto {
  @IsEnum(AccessRole)
  role!: AccessRole;

  @IsOptional()
  @IsBoolean()
  hidePrices?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string; // ISO строка даты

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number; // макс. использований

  // ⭐ №250: приглашение только в конкретный проект (null/нет — на весь объект)
  @IsOptional()
  @IsInt()
  @Min(1)
  projectId?: number;
}
