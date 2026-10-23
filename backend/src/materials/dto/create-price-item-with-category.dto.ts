import { Type } from 'class-transformer';
import { ValidateNested, IsOptional, IsString, IsEnum, IsInt } from 'class-validator';
import { CreatePriceItemDto } from '../../price-list/dto/create-price-item.dto';

export class CreatePriceItemWithCategoryDto {
  @ValidateNested()
  @Type(() => CreatePriceItemDto)
  item!: CreatePriceItemDto;

  @IsOptional()
  @IsString()
  newCategoryName?: string;

  @IsOptional()
  @IsEnum(['WORK', 'MATERIAL'])
  kind?: 'WORK' | 'MATERIAL';

  // ⭐ №159: справочник, в который кладём новую расценку (из сметы проекта).
  // Не передан → прежнее поведение: первый личный справочник пользователя.
  @IsOptional()
  @IsInt()
  catalogId?: number;
}