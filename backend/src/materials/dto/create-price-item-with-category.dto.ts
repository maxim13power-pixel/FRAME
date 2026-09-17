import { Type } from 'class-transformer';
import { ValidateNested, IsOptional, IsString, IsEnum } from 'class-validator';
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
}