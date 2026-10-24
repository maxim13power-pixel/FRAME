import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

// ⭐ №164: «поделиться» справочником = скопировать расценки в справочник объекта/проекта
export class CopyCatalogDto {
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Название справочника: не более 80 символов' })
  name?: string;

  @IsOptional()
  @IsInt({ message: 'objectId должен быть целым числом' })
  objectId?: number;

  @IsOptional()
  @IsInt({ message: 'projectId должен быть целым числом' })
  projectId?: number;
}
