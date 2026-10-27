// backend/src/object-templates/dto/create-object-from-template.dto.ts
// ⭐ №175: создание объекта из шаблона (разовая копия)
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateObjectFromTemplateDto {
  @IsString()
  @IsNotEmpty({ message: 'Название объекта обязательно' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Адрес обязателен' })
  address!: string;

  @IsDateString({}, { message: 'Дата начала имеет неверный формат' })
  startDate!: string;

  @IsDateString({}, { message: 'Дата окончания имеет неверный формат' })
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Заметка не более 1000 символов' })
  note?: string;

  // ⭐ №181: роль не выбирается — создатель объекта всегда администратор объекта.
}
