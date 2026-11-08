// backend/src/auth/login-throttle.service.ts
// ⭐ №217: защита входа от перебора пароля.
// Правила (решение владельца): после 3 неудачных попыток включаем капчу,
// после 5 — блокируем пару «IP + логин» на 15 минут. Успешный вход обнуляет счётчик.
// Состояние в памяти процесса: на Amvera один контейнер, Redis не нужен.
// ⚠️ При рестарте контейнера счётчики сбрасываются — это осознанно (не храним
// в БД «мусор» из попыток); для распределённого деплоя понадобится общий стор.

import { Injectable } from '@nestjs/common';

/** Сколько неудач терпим до капчи. */
export const LOGIN_CAPTCHA_AFTER = 3;
/** Сколько неудач терпим до блокировки. */
export const LOGIN_LOCK_AFTER = 5;
/** Блокировка, мс (15 минут). */
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
/** Через час без неудач счётчик «забывается». */
export const LOGIN_WINDOW_MS = 60 * 60 * 1000;
/** Защита от роста Map (больше 5000 ключей — чистим устаревшие). */
const MAX_KEYS = 5000;

export interface ThrottleKeys {
  ipKey: string;
  loginKey: string;
}

export interface ThrottleState {
  /** сколько неудач ещё разрешено до блокировки */
  attemptsLeft: number;
  /** нужна ли капча на этом шаге */
  captchaRequired: boolean;
  locked: boolean;
  retryAfterSeconds: number;
  fails: number;
}

interface Entry {
  fails: number;
  lockedUntil: number;
  lastFailAt: number;
}

@Injectable()
export class LoginThrottleService {
  private readonly entries = new Map<string, Entry>();
  /** Вынесено в поле, чтобы тесты могли подменить время. */
  private clock: () => number = () => Date.now();

  /** Только для тестов: фиксированное/управляемое время. */
  setClock(clock: () => number): void {
    this.clock = clock;
  }

  /** Ключи группировки: по IP и по логину (e-mail/телефон в нижнем регистре). */
  keys(ip: string | undefined, identifier: string): ThrottleKeys {
    const login = String(identifier ?? '').trim().toLowerCase();
    return {
      ipKey: `ip:${(ip || 'unknown').trim()}`,
      loginKey: `login:${login}`,
    };
  }

  /** Текущее состояние пары «IP + логин» (для проверки ПЕРЕД валидацией пароля). */
  check(keys: ThrottleKeys): ThrottleState {
    const now = this.clock();
    const ip = this.read(keys.ipKey, now);
    const login = this.read(keys.loginKey, now);
    const fails = Math.max(ip.fails, login.fails);
    // ⚠️ Блокируем ТОЛЬКО по IP: иначе злоумышленник, зная чужой e-mail, «залочивал»
    // бы аккаунт на 15 минут с любого адреса (DoS на конкретного пользователя).
    // Для самого аккаунта остаётся капча — она и мешает перебору.
    const lockedUntil = ip.lockedUntil;
    const locked = lockedUntil > now;
    return {
      fails,
      attemptsLeft: Math.max(0, LOGIN_LOCK_AFTER - fails),
      captchaRequired: locked || fails >= LOGIN_CAPTCHA_AFTER,
      locked,
      retryAfterSeconds: locked ? Math.ceil((lockedUntil - now) / 1000) : 0,
    };
  }

  /** Отмечает неудачную попытку и возвращает новое состояние. */
  registerFailure(keys: ThrottleKeys): ThrottleState {
    const now = this.clock();
    this.bump(keys.ipKey, now);
    this.bump(keys.loginKey, now);
    this.cleanup(now);
    return this.check(keys);
  }

  /** Успешный вход — снимаем накопленное. */
  reset(keys: ThrottleKeys): void {
    this.entries.delete(keys.ipKey);
    this.entries.delete(keys.loginKey);
  }

  private bump(key: string, now: number): void {
    const prev = this.read(key, now);
    const fails = prev.fails + 1;
    this.entries.set(key, {
      fails,
      lastFailAt: now,
      lockedUntil: fails >= LOGIN_LOCK_AFTER ? now + LOGIN_LOCK_MS : prev.lockedUntil,
    });
  }

  private read(key: string, now: number): Entry {
    const entry = this.entries.get(key);
    if (!entry) return { fails: 0, lockedUntil: 0, lastFailAt: 0 };
    // окно истекло и блокировка кончилась — считаем, что попыток не было
    const stale = now - entry.lastFailAt > LOGIN_WINDOW_MS && entry.lockedUntil <= now;
    if (stale) {
      this.entries.delete(key);
      return { fails: 0, lockedUntil: 0, lastFailAt: 0 };
    }
    return entry;
  }

  /** Ленивая уборка: не даём Map расти бесконечно. */
  private cleanup(now: number): void {
    if (this.entries.size < MAX_KEYS) return;
    for (const [key, entry] of this.entries) {
      const stale = now - entry.lastFailAt > LOGIN_WINDOW_MS && entry.lockedUntil <= now;
      if (stale) this.entries.delete(key);
    }
  }
}
