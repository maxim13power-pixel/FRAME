// backend/src/brigades/dto/log-shift.dto.ts
import {
  IsArray, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** ⭐ №169: строка состава выхода — «кто был» + «сколько часов» */
export class LogShiftMemberDto {
  @IsOptional()
  @IsInt({ message: 'members.memberId: целое число' })
  @Min(1, { message: 'members.memberId: больше 0' })
  memberId?: number;

  @IsNumber({}, { message: 'members.hours: обязательное число' })
  @Min(0.01, { message: 'members.hours: больше 0' })
  @Max(24, { message: 'members.hours: не больше 24' })
  hours!: number;
}

export class LogShiftDto {
  @IsISO8601({}, { message: 'date: ISO-дата обязательна' })
  date!: string;

  // ⭐ №169: если передан состав бригады, сумма часов считается на сервере,
  // а hoursWorked можно не присылать (оставлено для старых клиентов и мобильных бригад без состава).
  @IsOptional()
  @IsNumber({}, { message: 'hoursWorked: число или ничего' })
  @Min(0.01, { message: 'hoursWorked: больше 0' })
  @Max(600, { message: 'hoursWorked: не больше 600' })
  hoursWorked?: number;

  /** ⭐ №169: состав выхода (чекбоксы состава бригады) */
  @IsOptional()
  @IsArray({ message: 'members: массив или ничего' })
  @ValidateNested({ each: true })
  @Type(() => LogShiftMemberDto)
  members?: LogShiftMemberDto[];

  @IsOptional()
  @IsNumber({}, { message: 'outputValue: число или ничего' })
  @Min(0, { message: 'outputValue: не меньше 0' })
  outputValue?: number;

  @IsOptional()
  @IsNumber({}, { message: 'outputArea: число или ничего' })
  @Min(0, { message: 'outputArea: не меньше 0' })
  outputArea?: number;

  @IsOptional()
  @IsInt({ message: 'projectId: целое число или ничего' })
  @Min(1, { message: 'projectId: больше 0' })
  projectId?: number;

  @IsOptional()
  @IsString({ message: 'comment: строка или ничего' })
  @MaxLength(500, { message: 'comment: максимум 500 символов' })
  comment?: string;
}

