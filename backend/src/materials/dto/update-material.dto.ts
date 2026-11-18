import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { UNIT_VALUES } from './create-material.dto';

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Наименование не может быть пустым' })
  name?: string;

  @IsOptional()
  @IsString()
  article?: string;

  @IsOptional()
  @IsIn(UNIT_VALUES, { message: 'Некорректная единица измерения' })
  unit?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Количество должно быть числом' })
  @Min(0, { message: 'Количество не может быть отрицательным' })
  specQuantity?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsInt({ message: 'priceItemId должен быть целым числом' })
  priceItemId?: number | null;

  @IsOptional()
  @IsInt({ message: 'materialItemId должен быть целым числом' })
  materialItemId?: number | null;

  // ⭐ №275: цена, введённая прямо в смете. Меняет ТОЛЬКО строку (снапшот):
  // справочник остаётся прежним, пока пользователь явно не изменит расценку.
  @IsOptional()
  @IsNumber({}, { message: 'workPrice должен быть числом' })
  @Min(0, { message: 'Цена работы не может быть отрицательной' })
  workPrice?: number;

  @IsOptional()
  @IsNumber({}, { message: 'materialPrice должен быть числом' })
  @Min(0, { message: 'Цена материала не может быть отрицательной' })
  materialPrice?: number;

  // ⭐ №318: норма расхода материала на 1 единицу строки (в единицах упаковки).
  // null — сбросить норму и вернуться к цене «за единицу строки».
  @IsOptional()
  @IsNumber({}, { message: 'consumption должен быть числом' })
  @Min(0, { message: 'Расход не может быть отрицательным' })
  consumption?: number | null;
}
