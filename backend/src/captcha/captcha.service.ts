// backend/src/captcha/captcha.service.ts
// ⭐ Серверная проверка Yandex SmartCaptcha
// Документация: https://yandex.cloud/ru/docs/smartcaptcha/concepts/validation

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError, Observable } from 'rxjs';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';

// ⭐ ПОЛНЫЙ интерфейс ответа Яндекса (по официальной документации)
// См. https://yandex.cloud/ru/docs/smartcaptcha/concepts/validation#response
interface SmartCaptchaResponse {
  status: 'ok' | 'failed';
  message?: string;        // человекочитаемое сообщение об ошибке
  code?: number;           // внутренний код ошибки Яндекса
  hostname?: string;       // домен, на котором проверялась капча
}

// ⭐ Вспомогательный тип для RxJS: либо ответ Яндекса, либо null (fail-open)
type CaptchaValidationResult = AxiosResponse<SmartCaptchaResponse> | null;

@Injectable()
export class CaptchaService {
  // ⭐ Используем NestJS Logger, а не console.log
  private readonly logger = new Logger(CaptchaService.name);

  // 🔒 URL хардкодим НАМЕРЕННО — это публичный endpoint Яндекса,
  // не секрет. Делать его конфигурируемым = лишняя сложность без выгоды.
  private readonly VALIDATE_URL = 'https://smartcaptcha.yandexcloud.net/validate';

  // ⭐ Timeout в миллисекундах
  private readonly TIMEOUT_MS = 5000;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * ⭐ Публичный метод: валидация токена капчи.
   *
   * @param token — токен от Yandex SmartCaptcha widget
   * @param ip    — IP пользователя (ОБЯЗАТЕЛЕН по документации Яндекса)
   *
   * 🔒 ПОЧЕМУ IP НЕ ХЭШИРУЕМ:
   * Яндекс использует IP для anti-fraud анализа (проверка что запрос
   * пришёл с того же IP, с которого грузилась капча). Хэш не подойдёт —
   * Яндекс не сможет верифицировать. Это требование их API, не наше.
   * Мы логируем IP только в DEBUG-уровне (не в прод-логах).
   */
  async validate(token: string | undefined, ip: string): Promise<boolean> {
    // 1. Валидация входных данных ДО запроса
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      this.logger.warn('Попытка валидации пустого токена капчи');
      return false;
    }

    // 2. Читаем серверный ключ из env
    const secretKey = this.config.get<string>('SMARTCAPTCHA_SERVER_KEY');

    if (!secretKey) {
      this.logger.error(
        'SMARTCAPTCHA_SERVER_KEY не настроен в env. Капча отключена!',
      );
      return false;
    }

    // 3. Формируем запрос
    const params = new URLSearchParams({
      secret: secretKey,
      token: token.trim(),
      ip: ip,
    });
    const requestUrl = `${this.VALIDATE_URL}?${params.toString()}`;

    try {
      // 4. HTTP-запрос с таймаутом и fail-open обработкой
      // 🔒 ЯВНАЯ типизация: Observable<CaptchaValidationResult> —
      // TypeScript теперь знает что catchError возвращает null, а не undefined
      const response: CaptchaValidationResult = await firstValueFrom(
        this.http
          .get<SmartCaptchaResponse>(requestUrl, {
            headers: { 'User-Agent': 'FRAME-App/1.0' },
          })
          .pipe(
            timeout(this.TIMEOUT_MS),
            // ⭐ catchError теперь возвращает Observable<CaptchaValidationResult>
            // of(null) имеет правильный тип, TypeScript доволен
            catchError((err: Error): Observable<CaptchaValidationResult> => {
              this.logger.error(
                `Ошибка запроса к Yandex SmartCaptcha: ${err.message}`,
                err.stack,
              );
              return of(null);
            }),
          ),
      );

      // 5. Разбираем результат
      // 🔒 Проверка на null с type narrowing: после if response !== null,
      // TypeScript знает что response — AxiosResponse<SmartCaptchaResponse>
      if (response === null) {
        this.logger.warn(
          'Fail-open: Яндекс SmartCaptcha недоступен, пропускаем пользователя',
        );
        return true;
      }

      if (!response.data) {
        this.logger.warn('Пустой ответ от Yandex SmartCaptcha');
        return false;
      }

      const data: SmartCaptchaResponse = response.data;

      if (data.status === 'ok') {
        // ⭐ DEBUG level — IP не попадёт в продакшен-логи
        this.logger.debug('Капча успешно пройдена');
        return true;
      }

      // status === 'failed' — капча не пройдена
      this.logger.warn('Капча не пройдена', {
        yandexStatus: data.status,
        yandexMessage: data.message,
        yandexCode: data.code,
      });
      return false;

    } catch (error) {
      // 🔒 Финальная страховка: любая непредвиденная ошибка → fail-open
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Непредвиденная ошибка в CaptchaService: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return true;
    }
  }
}