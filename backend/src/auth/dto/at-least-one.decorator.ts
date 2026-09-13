// backend/src/auth/dto/at-least-one.decorator.ts
// ⭐ P0-5: Кастомный валидатор для проверки "хотя бы одно из полей"
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'atLeastOne', async: false })
export class AtLeastOneConstraint implements ValidatorConstraintInterface {
  validate(text: any, args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    const relatedValue = (args.object as any)[relatedPropertyName];
    // Возвращает true, если хотя бы одно из полей заполнено
    return !!text || !!relatedValue;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Укажите email или телефон';
  }
}

export function AtLeastOne(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [property],
      validator: AtLeastOneConstraint,
    });
  };
}