// backend/src/users/dto/update-profile.dto.ts
// ⭐ №215: правка своего профиля из «Настроек» — имя и телефон.
// Email и роль здесь НЕ меняются: email — это логин (нужна отдельная
// процедура подтверждения), роль выдаётся администратором объекта.
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Имя: строка' })
  @MinLength(2, { message: 'Имя минимум 2 символа' })
  fullName?: string;

  // Пустая строка = «убрать телефон»
  @IsOptional()
  @IsString({ message: 'Телефон: строка' })
  @Matches(/^\+?[0-9]{10,15}$|^$/, {
    message: 'Телефон: от 10 до 15 цифр, может начинаться с +',
  })
  phone?: string;
}
