// backend/src/imports/imports.controller.ts
// ⭐ №202 (RFC §8.2): импорт сметы из Excel.
// preview принимает multipart (file) ИЛИ JSON ({ projectId, rows: string[][], sourceName }).
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportsService } from './imports.service';
import type { CommitResolution } from './imports.service';

/** Файл из multer: нам нужны только имя и буфер (diskStorage не используем). */
interface UploadedXlsx {
  originalname: string;
  buffer: Buffer;
}

@Controller('imports/estimates')
@UseGuards(JwtAuthGuard)
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  preview(@UploadedFile() file: UploadedXlsx | undefined, @Body() body: any, @Req() req) {
    const projectId = Number(body?.projectId);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw new BadRequestException('Не указан проект импорта');
    }
    if (file?.buffer) {
      return this.imports.preview({
        projectId,
        userId: req.user.userId,
        fileName: file.originalname,
        buffer: file.buffer,
      });
    }
    // Вариант «вставка из буфера»: строки приходят как массив массивов
    let rows: unknown[][] | undefined;
    if (Array.isArray(body?.rows)) {
      rows = body.rows;
    } else if (typeof body?.rows === 'string') {
      try {
        const parsed = JSON.parse(body.rows);
        if (Array.isArray(parsed)) rows = parsed;
      } catch {
        throw new BadRequestException('Поле rows должно быть массивом строк таблицы');
      }
    }
    if (!rows) {
      throw new BadRequestException('Приложите файл .xlsx/.csv или строки таблицы');
    }
    return this.imports.preview({
      projectId,
      userId: req.user.userId,
      fileName: body?.sourceName ?? null,
      rows,
    });
  }

  @Post(':id/commit')
  commit(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { resolutions?: CommitResolution[] },
    @Req() req,
  ) {
    return this.imports.commit({
      batchId: id,
      userId: req.user.userId,
      resolutions: Array.isArray(body?.resolutions) ? body.resolutions : [],
    });
  }

  @Get()
  history(@Query('projectId', ParseIntPipe) projectId: number, @Req() req) {
    return this.imports.listHistory(projectId, req.user.userId);
  }

  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.imports.getBatch(id, req.user.userId);
  }
}
