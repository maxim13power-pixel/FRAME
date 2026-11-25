// backend/src/telemetry/telemetry.service.spec.ts
// ⭐ №396: публичный эндпоинт ошибок фронта. Проверяем лимиты (на IP и общий) и то,
// что в алерт уходит полезное: сообщение, страница, стек, контекст.
import { TelemetryService } from './telemetry.service';
import type { TelegramAlertsService } from '../common/alerts/telegram-alerts.service';
import type { ClientErrorDto } from './dto/client-error.dto';

const dto = (
  message = 'Cannot read properties of undefined',
): ClientErrorDto => ({
  message,
  stack: 'TypeError: …\n    at Materials.tsx:42',
  url: '/objects/1/projects/2/materials',
  context: 'window.error',
  userAgent: 'Chrome/158',
});

const makeService = (env: Record<string, string> = {}) => {
  process.env = { ...process.env, ...env };
  const alerts = {
    notify: jest.fn().mockResolvedValue(undefined),
  } as unknown as TelegramAlertsService;
  const service = new TelemetryService(alerts);
  return { service, alerts };
};

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe('TelemetryService', () => {
  it('отправляет алерт с сообщением, страницей, стеком и источником', () => {
    const { service, alerts } = makeService();
    service.report(dto(), '10.0.0.1');

    expect(alerts.notify).toHaveBeenCalledTimes(1);
    const payload = (alerts.notify as jest.Mock).mock.calls[0][0];
    expect(payload.title).toContain('window.error');
    expect(payload.details).toContain('Cannot read properties of undefined');
    expect(payload.details).toContain('/objects/1/projects/2/materials');
    expect(payload.details).toContain('Materials.tsx:42');
    expect(payload.details).toContain('10.0.0.1');
    expect(payload.key).toContain('client:');
  });

  it('лимит на IP: больше N ошибок в минуту не уходят в канал', () => {
    const { service, alerts } = makeService({
      CLIENT_ERROR_LIMIT_PER_MIN: '3',
    });
    for (let i = 0; i < 6; i += 1)
      service.report(dto(`ошибка ${i}`), '10.0.0.5');
    expect(alerts.notify).toHaveBeenCalledTimes(3);
  });

  it('разные IP считаются отдельно', () => {
    const { service, alerts } = makeService({
      CLIENT_ERROR_LIMIT_PER_MIN: '2',
    });
    service.report(dto('a'), '10.0.0.1');
    service.report(dto('b'), '10.0.0.1');
    service.report(dto('c'), '10.0.0.1'); // отброшено: лимит IP
    service.report(dto('d'), '10.0.0.2');
    expect(alerts.notify).toHaveBeenCalledTimes(3);
  });

  it('общий лимит защищает канал от флуда с разных IP', () => {
    const { service, alerts } = makeService({
      CLIENT_ERROR_LIMIT_PER_MIN: '100',
      CLIENT_ERROR_LIMIT_TOTAL_PER_MIN: '2',
    });
    for (let i = 0; i < 5; i += 1)
      service.report(dto(`ошибка ${i}`), `10.0.0.${i}`);
    expect(alerts.notify).toHaveBeenCalledTimes(2);
  });
});
