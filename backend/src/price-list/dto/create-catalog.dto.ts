import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCatalogDto {
  @IsString()
  @IsNotEmpty({ message: 'Название справочника обязательно' })
  @MaxLength(80, { message: 'Название справочника: не более 80 символов' })
  name!: string;
}
