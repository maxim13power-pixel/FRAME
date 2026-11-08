// backend/src/photos/photo-validation.spec.ts
// ⭐ №227: принимаем только реальные JPEG/PNG/WebP (по magic bytes) и валидируем комментарий.
import { BadRequestException } from '@nestjs/common';
import {
  PHOTO_COMMENT_MAX,
  detectImageMime,
  downloadName,
  extensionForMime,
  mimeFromKey,
  parseDimension,
  parsePhotoComment,
} from './photo-validation';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP'),
  Buffer.from([0, 0, 0, 0]),
]);

describe('detectImageMime — только JPEG/PNG/WebP', () => {
  it('распознаёт поддерживаемые форматы', () => {
    expect(detectImageMime(jpeg)).toBe('image/jpeg');
    expect(detectImageMime(png)).toBe('image/png');
    expect(detectImageMime(webp)).toBe('image/webp');
  });

  it('GIF, SVG, текст и обрезанный буфер — отказ', () => {
    expect(detectImageMime(Buffer.from('GIF89a----------'))).toBeNull();
    expect(detectImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageMime(Buffer.from('hello world!'))).toBeNull();
    expect(detectImageMime(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageMime(undefined)).toBeNull();
  });

  it('расширения и MIME по ключу', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('image/webp')).toBe('webp');
    expect(mimeFromKey('2026/11/abc.png')).toBe('image/png');
    expect(mimeFromKey('2026/11/abc.webp')).toBe('image/webp');
    expect(mimeFromKey('2026/11/abc.unknown')).toBe('image/jpeg');
    expect(downloadName(12, 'image/webp')).toBe('photo-12.webp');
  });
});

describe('parsePhotoComment', () => {
  it('пустой → null, текст обрезается по краям', () => {
    expect(parsePhotoComment(undefined)).toBeNull();
    expect(parsePhotoComment('   ')).toBeNull();
    expect(parsePhotoComment('  Заливка бетона  ')).toBe('Заливка бетона');
  });

  it('ровно 500 символов — ок, 501 — 400 (без молчаливой обрезки)', () => {
    const ok = 'я'.repeat(PHOTO_COMMENT_MAX);
    expect(parsePhotoComment(ok)).toBe(ok);
    expect(() => parsePhotoComment(ok + 'я')).toThrow(BadRequestException);
  });

  it('не строка — 400', () => {
    expect(() => parsePhotoComment(42)).toThrow(BadRequestException);
  });
});

describe('parseDimension', () => {
  it('целые 1..20000 или null', () => {
    expect(parseDimension('1600')).toBe(1600);
    expect(parseDimension(900)).toBe(900);
    expect(parseDimension('')).toBeNull();
    expect(parseDimension(undefined)).toBeNull();
    expect(parseDimension('0')).toBeNull();
    expect(parseDimension('-5')).toBeNull();
    expect(parseDimension('1.5')).toBeNull();
    expect(parseDimension('20001')).toBeNull();
  });
});
