// backend/src/brigades/dto/log-shift.dto.ts
import {
  IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';

export class LogShiftDto {
  @IsISO8601({}, { message: 'date: ISO-дата обязательна' })
  date!: string;

  @IsNumber({}, { message: 'hoursWorked: обязательное число' })
  @Min(0.01, { message: 'hoursWorked: больше 0' })
  @Max(24, { message: 'hoursWorked: не больше 24' })
  hoursWorked!: number;

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
