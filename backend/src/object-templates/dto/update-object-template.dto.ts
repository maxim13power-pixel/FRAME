// backend/src/object-templates/dto/update-object-template.dto.ts
// ⭐ №175: переименование/публикация шаблона объекта
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateObjectTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Название шаблона не более 120 символов' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Заметка не более 1000 символов' })
  note?: string;

  @IsOptional()
  @IsBoolean({ message: 'isPublic должен быть true/false' })
  isPublic?: boolean;
}
