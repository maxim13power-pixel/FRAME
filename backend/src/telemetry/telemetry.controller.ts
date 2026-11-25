// backend/src/telemetry/telemetry.controller.ts
// ⭐ №396: публичный приём ошибок фронта. Без авторизации: падение может случиться до логина.
// Всегда 204 — клиенту не нужно знать, приняли ошибку или отбросили лимитом.
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ClientErrorDto } from './dto/client-error.dto';
import { TelemetryService } from './telemetry.service';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Post('client-error')
  @HttpCode(204)
  clientError(@Body() dto: ClientErrorDto, @Req() req): void {
    const ip = (req?.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req?.ip || 'unknown';
    this.telemetry.report(dto, ip);
  }
}
