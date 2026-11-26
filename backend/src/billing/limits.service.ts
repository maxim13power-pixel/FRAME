// backend/src/billing/limits.service.ts
// ⭐ №407: единая точка проверки лимитов тарифа (docs/PRICING.md §4).
// Режимы (BILLING_ENFORCE):
//   off    — ничего не проверяем (поведение как до биллинга);
//   shadow — считаем и пишем в лог «would block», но НЕ блокируем (для наблюдения);
//   on     — блокируем с кодом LIMIT_* и понятным текстом про следующий тариф.
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { BillingService } from './billing.service';

export type LimitKind = 'objects' | 'rows' | 'photos' | 'storage' | 'writers' | 'viewers';

export interface LimitCheck {
  allowed: boolean;
  kind: LimitKind;
  code?: string;
  limit: number | null;
  used: number;
  left: number | null;
  message?: string;
  /** true, если проверка только залогирована (shadow) */
  shadowed?: boolean;
}

const CODES: Record<LimitKind, string> = {
  objects: 'LIMIT_OBJECTS',
  rows: 'LIMIT_ROWS',
  photos: 'LIMIT_PHOTOS',
  storage: 'LIMIT_STORAGE',
  writers: 'LIMIT_WRITERS',
  viewers: 'LIMIT_VIEWERS',
};

/** Тексты для UI/апселла (docs/PRICING.md §2 — что даёт следующий тариф). */
const UPSELL: Record<LimitKind, string> = {
  objects:
    'На Free можно вести только 1 объект. Прораб — 5 объектов и 5 000 строк за 499 ₽/мес.',
  rows:
    'Лимит строк сметы исчерпан. Прораб — 5 000 строк, Бригада — 30 000.',
  photos:
    'На Free доступно 5 активных фото. Прораб — 3 ГБ (≈10 000 снимков) с хранением по плану.',
  storage:
    'Закончилось место под фото. Докупить объём: +5 ГБ за 149 ₽/мес или перейти на Бригаду.',
  writers:
    'Достигнут лимит участников с правом записи. Прораб — 3, Бригада — 8.',
  viewers:
    'Достигнут лимит наблюдателей. Прораб — 5, Бригада — 30.',
};

@Injectable()
export class LimitsService {
  private readonly logger = new Logger('BillingLimits');

  constructor(private readonly billing: BillingService) {}

  get mode(): 'off' | 'shadow' | 'on' {
    return this.billing.mode;
  }

  /**
   * ⭐ №408: сериализация «проверить → создать» по аккаунту — против TOCTOU
   * (двойной клик «Создать объект» на Free с лимитом 1 давал 2 объекта).
   * Очередь в памяти процесса: при одном контейнере этого достаточно
   * (при нескольких — нужен `pg_advisory_xact_lock` в БД, см. PRICING §8.6).
   */
  private readonly chains = new Map<number, Promise<void>>();

  async runSerialized<T>(accountId: number, fn: () => Promise<T>): Promise<T> {
    // в off/shadow ничего не блокируем — там нет запрета
    if (this.mode !== 'on') return fn();
    const prev = this.chains.get(accountId) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    const tail: Promise<void> = run.then(
      () => undefined,
      () => undefined,
    );
    this.chains.set(accountId, tail);
    void tail.then(() => {
      if (this.chains.get(accountId) === tail) this.chains.delete(accountId);
    });
    return run;
  }

  /** Проверка без исключения: удобно для UI-плашек и для логов shadow. */
  async check(accountId: number, kind: LimitKind, add = 1): Promise<LimitCheck> {
    // при off даже не считаем — поведение продукта не меняется
    if (this.mode === 'off') {
      return { allowed: true, kind, limit: null, used: 0, left: null };
    }

    let snap;
    try {
      snap = await this.billing.getSnapshot(accountId);
    } catch (err) {
      // ⭐ №408: политика fail-open при сбое БД — не блокируем платящего из-за таймаута,
      // но пишем громкий лог, чтобы поймать перебор на сверке (PRICING §8.6).
      this.logger.error(
        `enforce_fail_open kind=${kind} account=${accountId} mode=${this.mode}: ${(err as Error).message}`,
      );
      return { allowed: true, kind, limit: null, used: 0, left: null, shadowed: true };
    }
    const plan = snap.plan;
    const usage = snap.usage;

    const pairs: Record<LimitKind, { limit: number | null; used: number }> = {
      objects: { limit: plan.maxObjects, used: usage.objects },
      rows: { limit: plan.maxRows, used: usage.rows },
      // фото: у Free — слоты, у платных — объём (МБ)
      photos: { limit: plan.maxPhotos, used: usage.photos },
      storage: { limit: plan.maxStorageMb, used: usage.storageMb },
      writers: { limit: plan.maxWriters, used: usage.writers },
      viewers: { limit: plan.maxViewers, used: usage.viewers },
    };

    const { limit, used } = pairs[kind];
    const left = limit == null ? null : Math.max(0, limit - used);
    const allowed = limit == null || used + add <= limit;

    if (!allowed) {
      const result: LimitCheck = {
        allowed: this.mode === 'shadow',
        kind,
        code: CODES[kind],
        limit,
        used,
        left,
        message: UPSELL[kind],
        shadowed: this.mode === 'shadow',
      };
      this.logger.warn(
        `would block ${CODES[kind]} account=${accountId} plan=${plan.code} used=${used} add=${add} limit=${limit} mode=${this.mode}`,
      );
      return result;
    }

    return { allowed: true, kind, limit, used, left };
  }

  /**
   * Проверка с исключением: в режиме `on` бросает 403 с машинным кодом,
   * в `shadow` — только лог, запрос проходит.
   */
  async assert(accountId: number, kind: LimitKind, add = 1): Promise<void> {
    const res = await this.check(accountId, kind, add);
    if (!res.allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        code: res.code,
        message: res.message,
        limit: res.limit,
        used: res.used,
        left: res.left,
      });
    }
  }
}
