import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  MaxLength,
  IsInt,
} from 'class-validator';
export class CreateObjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Название объекта обязательно' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Адрес обязателен' })
  address!: string;

  @IsDateString({}, { message: 'Дата начала имеет неверный формат' })
  @IsNotEmpty({ message: 'Дата начала обязательна' })
  startDate!: string;

  @IsDateString({}, { message: 'Дата окончания имеет неверный формат' })
  @IsNotEmpty({ message: 'Дата окончания обязательна' })
  endDate!: string;

  @IsOptional()
  @IsDateString({}, { message: 'plannedEndDate имеет неверный формат' })
  plannedEndDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Заметка не более 1000 символов' })
  note?: string;

  // ⭐ №181: роли создателя больше нет — создатель объекта всегда администратор объекта.

  // ⭐ №164: справочник цен объекта (null — отвязать)
  @IsOptional()
  @IsInt({ message: 'catalogId должен быть целым числом' })
  catalogId?: number | null;
}
