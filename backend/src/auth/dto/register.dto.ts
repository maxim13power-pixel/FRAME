import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
  Matches,
} from 'class-validator';
import { AtLeastOne } from './at-least-one.decorator';
import { IsStrongPassword } from './is-strong-password.decorator';

export class RegisterDto {
  @IsOptional()
  @IsEmail({}, { message: 'Некорректный email' })
  @AtLeastOne('phone', { message: 'Укажите email или телефон' })
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: 'Телефон: от 10 до 15 цифр, может начинаться с +',
  })
  @AtLeastOne('email', { message: 'Укажите email или телефон' })
  phone?: string;

  @IsString({ message: 'Пароль обязателен' })
  @IsStrongPassword()
  password!: string;

  @IsString({ message: 'Имя обязательно' })
  @MinLength(2, { message: 'Имя минимум 2 символа' })
  fullName!: string;

  // ⭐ Шаг 77: токен Yandex SmartCaptcha (опционально в dev, обязателен в prod)
  @IsOptional()
  @IsString()
  captchaToken?: string;
}
