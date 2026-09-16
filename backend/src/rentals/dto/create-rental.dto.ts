// backend/src/rentals/dto/create-rental.dto.ts
// ⭐ Раздел «Аренда»: DTO создания аренды.
// Личное оборудование ПОЛЬЗОВАТЕЛЯ — никаких ролей и объектов, только userId из JWT.
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// ⭐ Кастомная проверка: endDate не раньше startDate
@ValidatorConstraint({ name: 'endDateNotBeforeStart' })
class EndDateNotBeforeStartConstraint implements ValidatorConstraintInterface {
  validate(endDate: string, args: ValidationArguments) {
    const dto = args.object as CreateRentalDto;
    if (!dto.startDate) return false;
    return new Date(endDate).getTime() >= new Date(dto.startDate).getTime();
  }
  defaultMessage() {
    return 'endDate: должна быть не раньше startDate';
  }
}

export class CreateRentalDto {
  @IsString({ message: 'name: обязательная строка' })
  @MinLength(1, { message: 'name: минимум 1 символ' })
  @MaxLength(200, { message: 'name: максимум 200 символов' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'location: строка или ничего' })
  @MaxLength(200, { message: 'location: максимум 200 символов' })
  location?: string;

  @IsOptional()
  @IsString({ message: 'responsible: строка или ничего' })
  @MaxLength(200, { message: 'responsible: максимум 200 символов' })
  responsible?: string;

  @IsISO8601({}, { message: 'startDate: ISO-дата обязательна' })
  startDate!: string;

  @IsISO8601({}, { message: 'endDate: обязательная ISO-дата' })
  @Validate(EndDateNotBeforeStartConstraint)
  endDate!: string;

  @IsNumber({}, { message: 'price: обязательное число' })
  @Min(0, { message: 'price: число не меньше 0' })
  price!: number;

  @IsOptional()
  @IsString({ message: 'note: строка или ничего' })
  note?: string;
}