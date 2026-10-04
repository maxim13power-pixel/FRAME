// backend/src/estimate-templates/dto/apply-estimate-template.dto.ts
import { IsInt, Min } from 'class-validator';

export class ApplyEstimateTemplateDto {
  @IsInt({ message: 'projectId: целое число' })
  @Min(1, { message: 'projectId: больше 0' })
  projectId!: number;
}
