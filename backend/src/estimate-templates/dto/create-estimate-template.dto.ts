// backend/src/estimate-templates/dto/create-estimate-template.dto.ts
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateEstimateTemplateDto {
  @IsString({ message: 'Название шаблона: строка' })
  @IsNotEmpty({ message: 'Название шаблона обязательно' })
  name!: string;

  @IsInt({ message: 'projectId: целое число' })
  @Min(1, { message: 'projectId: больше 0' })
  projectId!: number;
}
