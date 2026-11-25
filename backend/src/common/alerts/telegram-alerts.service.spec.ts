// backend/src/common/alerts/telegram-alerts.service.spec.ts
// ⭐ №396: алерты не должны ни падать, ни спамить. Проверяем выключенное состояние,
// формат запроса, антифлуд по окну и устойчивость к сбоям сети.
import { TelegramAlertsService } from './telegram-alerts.service';

const originalEnv = { ...process.env };
let fetchMock: jest.Mock;

const makeService = (env: Record<string, string | undefined> = {}) => {
  process.env = {
    ...originalEnv,
    TELEGRAM_ALERT_BOT_TOKEN: 'test-token',
    TELEGRAM_ALERT_CHAT_ID: '-1001234567890',
    TELEGRAM_ALERT_API_BASE: 'https://tg.example',
    TELEGRAM_ALERT_WINDOW_MS: '300000',
    NODE_ENV: 'test',
    ...env,
  };
  return new TelegramAlertsService();
};

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = fetchMock;
  jest.useRealTimers();
});

afterEach(() => {
  process.env = { ...originalEnv };
  jest.useRealTimers();
});

describe('TelegramAlertsService', () => {
  it('без токена или чата выключен и не ходит в сеть', async () => {
    const service = makeService({ TELEGRAM_ALERT_BOT_TOKEN: '' });
    expect(service.isEnabled()).toBe(false);
    await service.notify({ key: 'k', title: 't', details: 'd' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('отправляет сообщение в Telegram (токен в URL, chat_id и текст в теле)', async () => {
    const service = makeService();
    await service.notify({ key: 'http500:GET /x', title: 'HTTP 500 · GET /x', details: 'TypeError: boom' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://tg.example/bottest-token/sendMessage');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.chat_id).toBe('-1001234567890');
    expect(body.text).toContain('HTTP 500 · GET /x');
    expect(body.text).toContain('TypeError: boom');
    expect(body.disable_web_page_preview).toBe(true);
  });

  it('антифлуд: повтор в окне не уходит, после окна — со счётчиком повторов', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-25T10:00:00.000Z'));
    const service = makeService();

    await service.notify({ key: 'same', title: 'ошибка', details: 'x' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date('2026-11-25T10:01:00.000Z'));
    await service.notify({ key: 'same', title: 'ошибка', details: 'x' });
    await service.notify({ key: 'same', title: 'ошибка', details: 'x' });
    expect(fetchMock).toHaveBeenCalledTimes(1); // ещё внутри окна — молчим

    jest.setSystemTime(new Date('2026-11-25T10:06:30.000Z')); // окно истекло
    await service.notify({ key: 'same', title: 'ошибка', details: 'x' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(body.text).toContain('повторилось 2 раз');
  });

  it('разные ключи уходят независимо', async () => {
    const service = makeService();
    await service.notify({ key: 'a', title: 'A' });
    await service.notify({ key: 'b', title: 'B' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('сбой сети не бросает исключение', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const service = makeService();
    await expect(service.notify({ key: 'k', title: 't' })).resolves.toBeUndefined();
  });

  it('ответ Telegram с ошибкой не бросает исключение', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' });
    const service = makeService();
    await expect(service.notify({ key: 'k', title: 't' })).resolves.toBeUndefined();
  });

  it('длинный текст обрезается до лимита Telegram', async () => {
    const service = makeService();
    await service.notify({ key: 'long', title: 't', details: 'я'.repeat(9000) });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.text.length).toBeLessThanOrEqual(3901);
    expect(body.text.endsWith('…')).toBe(true);
  });
});
