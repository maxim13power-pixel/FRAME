// backend/src/object-templates/dto/create-object-template.dto.ts
// ⭐ №175: «Сохранить объект как шаблон»
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateObjectTemplateDto {
  @IsInt({ message: 'objectId должен быть числом' })
  objectId!: number;

  // Если не передано — берём имя объекта
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Название шаблона не более 120 символов' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Заметка не более 1000 символов' })
  note?: string;

  // Общий шаблон (виден всем) или личный
  @IsOptional()
  @IsBoolean({ message: 'isPublic должен быть true/false' })
  isPublic?: boolean;
}
