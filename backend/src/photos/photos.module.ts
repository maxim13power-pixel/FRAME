// backend/src/photos/photos.module.ts
// ⭐ №227: модуль фото-фиксации материалов. Хранилище — за интерфейсом PHOTO_STORAGE
// (сейчас локальный диск/volume, позже S3 без изменения сервиса).
import { Module } from '@nestjs/common';
import { PhotosController, PhotosFeedController } from './photos.controller';
import { PhotosService } from './photos.service';
import { PHOTO_STORAGE, createPhotoStorage } from './photo-storage';

@Module({
  controllers: [PhotosController, PhotosFeedController],
  providers: [
    PhotosService,
    {
      provide: PHOTO_STORAGE,
      useFactory: () => createPhotoStorage(),
    },
  ],
})
export class PhotosModule {}
