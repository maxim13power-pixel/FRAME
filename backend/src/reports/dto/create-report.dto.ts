// backend/src/reports/dto/create-report.dto.ts
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateReportDto {
  @IsIn(['estimate', 'act'], { message: 'type: estimate / act' })
  type!: string;

  @IsString({ message: 'title: обязательная строка' })
  @MinLength(1, { message: 'title: минимум 1 символ' })
  @MaxLength(300, { message: 'title: максимум 300 символов' })
  title!: string;

  @IsInt({ message: 'projectId: целое число' })
  @Min(1, { message: 'projectId: больше 0' })
  projectId!: number;

  @IsInt({ message: 'objectId: целое число' })
  @Min(1, { message: 'objectId: больше 0' })
  objectId!: number;

  @IsOptional()
  @IsString({ message: 'comment: строка или ничего' })
  @MaxLength(1000, { message: 'comment: максимум 1000 символов' })
  comment?: string;
}
