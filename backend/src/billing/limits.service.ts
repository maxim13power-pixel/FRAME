// backend/src/billing/limits.service.ts
// ⭐ №407: единая точка проверки лимитов тарифа (docs/PRICING.md §4).
// Режимы (BILLING_ENFORCE):
//   off    — ничего не проверяем (поведение как до биллинга);
//   shadow — считаем и пишем в лог «would block», но НЕ блокируем (для наблюдения);
//   on     — блокируем с кодом LIMIT_* и понятным текстом про следующий тариф.
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { BillingService, PlanView } from './billing.service';

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

/** Тексты апселла собираются из чисел тарифа в БД — лимиты можно менять без правки кода. */
const PLAN_LABEL: Record<string, string> = {
  FREE: 'Free',
  FOREMAN: 'Прораб',
  TEAM: 'Бригада',
};

const KIND_LABEL: Record<LimitKind, string> = {
  objects: 'объектов',
  rows: 'строк смет',
  photos: 'фото',
  storage: 'МБ под фото',
  writers: 'участников с правом записи',
  viewers: 'наблюдателей',
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
        message: await this.upsellMessage(kind, plan, add),
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
   * ⭐ №409: текст апселла собирается из чисел тарифа (не хардкод).
   * Берём текущий план и следующий доступный — текст не врёт после смены лимитов в БД.
   */
  private async upsellMessage(
    kind: LimitKind,
    plan: PlanView,
    add: number,
  ): Promise<string> {
    const nextCode =
      plan.code === 'FREE' ? 'FOREMAN' : plan.code === 'FOREMAN' ? 'TEAM' : null;
    const next = nextCode ? await this.billing.getPlan(nextCode).catch(() => null) : null;

    const head: Record<LimitKind, string> = {
      objects: `Достигнут лимит объектов (${plan.maxObjects}).`,
      rows: `Не хватает строк: нужно ${add}, свободно ${Math.max(0, plan.maxRows)}.`,
      photos: `Закончились слоты фото (${plan.maxPhotos ?? 0} активных).`,
      storage: `Закончилось место под фото (${Math.round((plan.maxStorageMb ?? 0) / 1024)} ГБ).`,
      writers: `Достигнут лимит участников с правом записи (${plan.maxWriters}).`,
      viewers: `Достигнут лимит наблюдателей (${plan.maxViewers}).`,
    };

    const offer = next
      ? ` ${next.name} — ${next.maxObjects} объектов и ${next.maxRows} строк за ${next.priceMonthly} ₽/мес.`
      : '';
    return `${head[kind]}${offer} Всё введённое сохранится.`;
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
