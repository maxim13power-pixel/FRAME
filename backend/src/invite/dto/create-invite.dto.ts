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

  /**
   * ⭐ №303: «разрешить создавать проекты» — право имеет смысл только для прораба
   * и только для ссылки на весь объект (не в конкретный проект).
   */
  @IsOptional()
  @IsBoolean()
  canCreateProjects?: boolean;

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
