// backend/src/reports/dto/update-report.dto.ts
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateReportDto {
  @IsOptional()
  @IsString({ message: 'title: строка или ничего' })
  @MinLength(1, { message: 'title: минимум 1 символ' })
  @MaxLength(300, { message: 'title: максимум 300 символов' })
  title?: string;

  @IsOptional()
  @IsIn(['draft', 'sent', 'approved', 'rejected'], {
    message: 'status: draft / sent / approved / rejected',
  })
  status?: string;

  @IsOptional()
  @IsString({ message: 'comment: строка или ничего' })
  @MaxLength(1000, { message: 'comment: максимум 1000 символов' })
  comment?: string;
}
