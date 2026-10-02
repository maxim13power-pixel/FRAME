// backend/src/auth/dto/request-code.dto.ts
// ⭐ №122b: запрос кода верификации email.
import { IsEmail } from 'class-validator';

export class RequestCodeDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;
}
