import { IsInt, IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Название категории обязательно' })
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsIn(['WORK', 'MATERIAL'], { message: 'Некорректный тип расценки' })
  kind?: string;
}