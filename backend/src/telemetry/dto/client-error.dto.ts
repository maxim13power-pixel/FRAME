// backend/src/telemetry/dto/client-error.dto.ts
// ⭐ №396: тело ошибки, которую присылает фронт (window.onerror / unhandledrejection).
// Лимиты жёсткие: эндпоинт публичный, тело не должно превращаться в канал спама.
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClientErrorDto {
  @IsString()
  @MaxLength(500, { message: 'message слишком длинный' })
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000, { message: 'stack слишком длинный' })
  stack?: string;

  /** адрес страницы, где случилось (без query — его отрезает фронт) */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  userAgent?: string;

  /** источник: window.error / unhandledrejection / react */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  context?: string;
}
