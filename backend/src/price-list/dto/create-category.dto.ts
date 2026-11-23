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

  // ⭐ №373 (B2): категория создаётся в конкретном справочнике
  @IsOptional()
  @IsInt({ message: 'catalogId: целое число' })
  catalogId?: number;
}
