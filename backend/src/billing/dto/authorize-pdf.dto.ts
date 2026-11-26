// backend/src/billing/dto/authorize-pdf.dto.ts
// ⭐ №405: запрос на печать/экспорт PDF. Сервер решает: можно ли, с каким лимитом строк и знаком.
import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AuthorizePdfDto {
  @IsInt()
  @Min(1)
  projectId!: number;

  /** Строки, которые попадут в документ (для хеша содержимого), не больше 50 000 */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  materialIds?: number[];

  /** Активные фильтры — тоже часть содержимого документа */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  /** Сколько строк реально будет в документе — проверяется против maxExportRows плана */
  @IsInt()
  @Min(0)
  @Max(50000)
  rowCount!: number;
}
