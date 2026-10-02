// backend/src/brigades/dto/create-brigade.dto.ts
import {
  IsInt, IsOptional, IsString, MaxLength, Min, MinLength,
} from 'class-validator';

export class CreateBrigadeDto {
  @IsString({ message: 'name: обязательная строка' })
  @MinLength(1, { message: 'name: минимум 1 символ' })
  @MaxLength(200, { message: 'name: максимум 200 символов' })
  name!: string;

  @IsOptional()
  @IsString({ message: 'specialty: строка или ничего' })
  @MaxLength(100, { message: 'specialty: максимум 100 символов' })
  specialty?: string;

  @IsOptional()
  @IsString({ message: 'foremanName: строка или ничего' })
  @MaxLength(200, { message: 'foremanName: максимум 200 символов' })
  foremanName?: string;

  @IsOptional()
  @IsString({ message: 'phone: строка или ничего' })
  @MaxLength(50, { message: 'phone: максимум 50 символов' })
  phone?: string;

  @IsOptional()
  @IsInt({ message: 'objectId: целое число или ничего' })
  @Min(1, { message: 'objectId: больше 0' })
  objectId?: number;

  @IsOptional()
  @IsString({ message: 'comment: строка или ничего' })
  @MaxLength(500, { message: 'comment: максимум 500 символов' })
  comment?: string;
}
