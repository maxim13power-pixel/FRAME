import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateFixDto {
  @IsNumber({}, { message: 'Объём должен быть числом' })
  @Min(0.001, { message: 'Объём должен быть больше нуля' })
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;

  // ⭐ №174: дата фиксации «задним числом» (ГГГГ-ММ-ДД).
  // Не передана — фиксация на текущий момент. Будущее запрещено,
  // назад — не глубже 3 предыдущих календарных дней (проверка в сервисе).
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Дата фиксации должна быть в формате ГГГГ-ММ-ДД',
  })
  fixedDate?: string;

  // ⭐ №174: смещение зоны клиента (Date#getTimezoneOffset, минуты UTC−локальное),
  // чтобы окно считалось по календарю устройства, а не сервера.
  @IsOptional()
  @IsInt({ message: 'tzOffset должен быть целым числом минут' })
  @Min(-840)
  @Max(840)
  tzOffset?: number;
}
