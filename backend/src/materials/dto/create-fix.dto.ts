import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFixDto {
  @IsNumber({}, { message: 'Объём должен быть числом' })
  @Min(0.001, { message: 'Объём должен быть больше нуля' })
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}