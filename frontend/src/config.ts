// frontend/src/config.ts
// ⭐ Централизованный конфиг приложения.
// ВАЖНО для Universal Links / Deep Links: URL приложения должен быть
// одинаковым для веба и мобилки, чтобы ОС могла связать домен с приложением.

/**
 * Публичный URL приложения (используется для генерации ссылок-приглашений).
 * - В dev-режиме: http://localhost:5000
 * - В проде: https://frame.app (или твой реальный домен)
 *
 * Как это связано с Universal Links:
 * Когда приложение будет опубликовано в сторах, этот же домен будет
 * использоваться как Universal Link (iOS) / App Link (Android).
 * ОС на смартфоне будет проверять: «Принадлежит ли https://frame.app
 * приложению FRAME?» — и если да, сразу откроет приложение вместо браузера.
 */
export const APP_URL =
  (import.meta.env.VITE_APP_URL as string) ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'https://frame.app');

/**
 * Custom URL scheme для будущих прямых deep links.
 * Пример: frame://invite/xYz123AbC
 * Пока не используется — задел на будущее.
 */
export const APP_SCHEME = 'frame';

/**
 * Ссылки на сторы — появятся когда опубликуем приложение.
 * Пока пустые строки-заглушки.
 */
export const STORE_URLS = {
  appStore: '',   // TODO: добавить ссылку на App Store
  ruStore: '',    // TODO: добавить ссылку на RuStore
  playMarket: '', // TODO: добавить ссылку на Google Play
};