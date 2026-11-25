// backend/src/telemetry/telemetry.controller.ts
// ⭐ №396: публичный приём ошибок фронта. Без авторизации: падение может случиться до логина.
// Всегда 204 — клиенту не нужно знать, приняли ошибку или отбросили лимитом.
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ClientErrorDto } from './dto/client-error.dto';
import { TelemetryService } from './telemetry.service';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Post('client-error')
  @HttpCode(204)
  clientError(@Body() dto: ClientErrorDto, @Req() req: Request): void {
    // За прокси (Amvera) реальный адрес приходит в x-forwarded-for; берём первый.
    const forwarded = req.headers['x-forwarded-for'];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = first?.split(',')[0]?.trim() || req.ip || 'unknown';
    // ⭐ №399: автотесты (регрессия/smoke) помечают свои запросы, чтобы не будить боевой канал.
    const skipAlert = req.headers['x-frame-test'] === '1';
    this.telemetry.report(dto, ip, { skipAlert });
  }
}
