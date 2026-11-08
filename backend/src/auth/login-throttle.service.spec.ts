// backend/src/auth/login-throttle.service.spec.ts
// ⭐ №217: капча после 3 неудачных входов, блокировка после 5, сброс при успехе.
import { LoginThrottleService } from './login-throttle.service';


describe('LoginThrottleService (№217)', () => {
  const NOW = 1_800_000_000_000;
  const makeThrottle = () => {
    const t = new LoginThrottleService();
    let now = NOW;
    t.setClock(() => now);
    return { t, advance: (ms: number) => (now += ms) };
  };

  it('после 3 неудач требуется капча, но вход ещё возможен', () => {
    const { t } = makeThrottle();
    const keys = t.keys('1.1.1.1', 'User@Mail.ru');
    t.registerFailure(keys);
    t.registerFailure(keys);
    expect(t.check(keys).captchaRequired).toBe(false); // 2 неудачи — капчи нет
    t.registerFailure(keys);
    const state = t.check(keys);
    expect(state.captchaRequired).toBe(true);
    expect(state.locked).toBe(false);
    expect(state.attemptsLeft).toBe(2); // 5 - 3
  });

  it('после 5 неудач — блокировка на 15 минут', () => {
    const { t } = makeThrottle();
    const keys = t.keys('1.1.1.1', 'a@b.ru');
    for (let i = 0; i < 5; i += 1) t.registerFailure(keys);
    const state = t.check(keys);
    expect(state.locked).toBe(true);
    expect(state.retryAfterSeconds).toBe(15 * 60);
  });

  it('блокировка снимается по времени', () => {
    const { t, advance } = makeThrottle();
    const keys = t.keys('1.1.1.1', 'a@b.ru');
    for (let i = 0; i < 5; i += 1) t.registerFailure(keys);
    advance(15 * 60 * 1000 + 1000);
    expect(t.check(keys).locked).toBe(false);
  });

  it('успешный вход обнуляет счётчики', () => {
    const { t } = makeThrottle();
    const keys = t.keys('1.1.1.1', 'a@b.ru');
    t.registerFailure(keys);
    t.registerFailure(keys);
    t.reset(keys);
    expect(t.check(keys)).toMatchObject({ fails: 0, captchaRequired: false, locked: false });
  });

  it('счётчик «забывается» через час без неудач', () => {
    const { t, advance } = makeThrottle();
    const keys = t.keys('1.1.1.1', 'a@b.ru');
    t.registerFailure(keys);
    t.registerFailure(keys);
    t.registerFailure(keys);
    advance(60 * 60 * 1000 + 1000);
    expect(t.check(keys).captchaRequired).toBe(false);
  });

  it('блокировка привязана к IP; аккаунт защищает капча', () => {
    const { t } = makeThrottle();
    const victim = t.keys('1.1.1.1', 'a@b.ru');
    for (let i = 0; i < 5; i += 1) t.registerFailure(victim);

    // тот же логин с ДРУГОГО IP не заблокирован — нельзя «залочить» чужой аккаунт
    const otherIp = t.check(t.keys('2.2.2.2', 'a@b.ru'));
    expect(otherIp.locked).toBe(false);
    // ...но капча для этого аккаунта уже обязательна — перебор не пройдёт
    expect(otherIp.captchaRequired).toBe(true);

    // а вот сам IP заблокирован целиком (перебор с одного адреса)
    expect(t.check(t.keys('1.1.1.1', 'other@b.ru')).locked).toBe(true);
  });
});
