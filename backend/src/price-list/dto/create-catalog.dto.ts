import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCatalogDto {
  @IsString()
  @IsNotEmpty({ message: 'Название справочника обязательно' })
  @MaxLength(80, { message: 'Название справочника: не более 80 символов' })
  name!: string;

  // ⭐ №164: сразу привязать справочник к объекту или проекту
  @IsOptional()
  @IsInt({ message: 'objectId должен быть целым числом' })
  objectId?: number;

  @IsOptional()
  @IsInt({ message: 'projectId должен быть целым числом' })
  projectId?: number;
}
