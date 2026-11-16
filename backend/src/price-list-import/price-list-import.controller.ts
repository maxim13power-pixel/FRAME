// backend/src/price-list-import/price-list-import.controller.ts
// ⭐ №273 (§121): выгрузка/шаблон прайса, предпросмотр и импорт, уточнение единиц.
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PriceKind, Unit } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { fixMultipartFileName } from '../imports/name-normalizer';
import { PriceListImportService } from './price-list-import.service';
import type { PriceUnitOverrides } from './price-list-import.types';

interface UploadedXlsx {
  originalname: string;
  buffer: Buffer;
}

const parseKind = (kind: string | undefined): PriceKind => {
  if (kind === 'WORK' || kind === 'MATERIAL') return kind;
  throw new BadRequestException('kind должен быть WORK или MATERIAL');
};

/** Правки единиц приходят JSON-строкой из multipart-формы */
const parseOverrides = (raw: unknown): PriceUnitOverrides => {
  if (raw == null || raw === '') return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: PriceUnitOverrides = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') out[key] = value as Unit;
    }
    return out;
  } catch {
    throw new BadRequestException('Поле units должно быть JSON-объектом');
  }
};

@Controller('price-list')
@UseGuards(JwtAuthGuard)
export class PriceListImportController {
  constructor(private readonly service: PriceListImportService) {}

  /** Скачать шаблон (он же выгрузка текущего справочника) */
  @Get('catalogs/:id/export')
  async export(
    @Param('id', ParseIntPipe) id: number,
    @Query('kind') kind: string | undefined,
    @Req() req,
    @Res() res: Response,
  ) {
    const file = await this.service.export(id, parseKind(kind), req.user.userId);
    // ASCII-фолбэк для старых клиентов + RFC 5987 для кириллицы
    const ascii = file.fileName.replace(/[^\x20-\x7E]/g, '_');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    res.send(file.buffer);
  }

  @Post('catalogs/:id/import/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  preview(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedXlsx | undefined,
    @Body() body: { kind?: string; units?: string },
    @Req() req,
  ) {
    if (!file?.buffer) throw new BadRequestException('Приложите файл .xlsx');
    return this.service.preview({
      catalogId: id,
      kind: parseKind(body?.kind),
      userId: req.user.userId,
      fileName: fixMultipartFileName(file.originalname),
      buffer: file.buffer,
      overrides: parseOverrides(body?.units),
    });
  }

  @Post('catalogs/:id/import/commit')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  commit(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedXlsx | undefined,
    @Body() body: { kind?: string; units?: string },
    @Req() req,
  ) {
    if (!file?.buffer) throw new BadRequestException('Приложите файл .xlsx');
    return this.service.commit({
      catalogId: id,
      kind: parseKind(body?.kind),
      userId: req.user.userId,
      fileName: fixMultipartFileName(file.originalname),
      buffer: file.buffer,
      overrides: parseOverrides(body?.units),
    });
  }

  /** Черновики: единица не распознана (позиции неактивны) */
  @Get('catalogs/:id/clarifications')
  clarifications(
    @Param('id', ParseIntPipe) id: number,
    @Query('kind') kind: string | undefined,
    @Req() req,
  ) {
    const parsed =
      kind === 'WORK' || kind === 'MATERIAL' ? (kind as PriceKind) : undefined;
    return this.service.listClarifications(id, req.user.userId, parsed);
  }

  @Post('catalogs/:id/clarifications')
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { raw?: string; ids?: number[]; unit?: string },
    @Req() req,
  ) {
    if (!body?.unit) throw new BadRequestException('Укажите единицу');
    return this.service.resolveClarifications(id, req.user.userId, {
      raw: body.raw,
      ids: Array.isArray(body.ids) ? body.ids : undefined,
      unit: body.unit as Unit,
    });
  }
}
