// backend/src/auth/dto/is-strong-password.decorator.ts
// ⭐ №215: декоратор class-validator поверх общей политики пароля.
// Используется в RegisterDto, VerifyEmailDto, ResetPasswordDto, ChangePasswordDto —
// чтобы ошибка приходила понятным текстом и до похода в сервис.
import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';
import { passwordIssue } from '../password-policy';

export const IsStrongPassword = (options?: ValidationOptions) =>
  (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => passwordIssue(value) === null,
        defaultMessage: (args?: ValidationArguments) =>
          passwordIssue(args?.value) ?? 'Пароль слишком простой',
      },
    });
  };
