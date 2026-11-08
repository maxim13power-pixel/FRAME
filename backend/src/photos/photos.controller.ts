// backend/src/photos/photos.controller.ts
// ⭐ №227: API фото-фиксации материала. Файлы — только через JWT-эндпоинт,
// публичной статики нет (иначе фото утекали бы по прямой ссылке).
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PhotosService } from './photos.service';
import type { UploadedImage } from './photos.service';
import { PHOTO_MAX_BYTES } from './photo-validation';

interface AuthedRequest {
  user: { userId: number };
}

interface PhotoUploadFiles {
  file?: UploadedImage[];
  thumb?: UploadedImage[];
}

@Controller('materials')
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  /** Список фото материала (свежие сверху). */
  @Get(':id/photos')
  list(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.photos.list(id, req.user.userId);
  }

  /**
   * Загрузка фото: multipart `file` (обязательно), `thumb` (миниатюра 320 px),
   * `comment` (до 500 симв.), `width`/`height` (клиент знает размеры после сжатия).
   */
  @Post(':id/photos')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'thumb', maxCount: 1 },
      ],
      { limits: { fileSize: PHOTO_MAX_BYTES } },
    ),
  )
  upload(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: PhotoUploadFiles | undefined,
    @Body() body: Record<string, unknown> | undefined,
  ) {
    return this.photos.upload(
      id,
      req.user.userId,
      files?.file?.[0],
      files?.thumb?.[0],
      body ?? {},
    );
  }

  /** Файл фото: ?variant=thumb|full (без thumb отдаём полный). */
  @Get('photos/:photoId/file')
  async file(
    @Req() req: AuthedRequest,
    @Param('photoId', ParseIntPipe) photoId: number,
    @Query('variant') variant: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result = await this.photos.readFile(
      photoId,
      req.user.userId,
      variant === 'thumb' ? 'thumb' : 'full',
    );
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
    // Фото объекта не должно кешироваться общими прокси
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(result.data);
  }

  /** Удаление (автор / администратор объекта / глобальный ADMIN). */
  @Delete('photos/:photoId')
  remove(@Req() req: AuthedRequest, @Param('photoId', ParseIntPipe) photoId: number) {
    return this.photos.remove(photoId, req.user.userId);
  }
}
