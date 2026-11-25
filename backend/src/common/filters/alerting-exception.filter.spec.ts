// backend/src/common/filters/alerting-exception.filter.spec.ts
// ⭐ №396: фильтр не должен менять ответы API — проверяем, что 5xx уходят в алерты,
// а 4xx (валидация, права) не шумят в канал, и что ответ формирует базовый фильтр Nest.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AlertingExceptionFilter, exceptionStatus } from './alerting-exception.filter';
import type { TelegramAlertsService } from '../alerts/telegram-alerts.service';

const makeHost = () => {
  const response = { status: jest.fn(), json: jest.fn(), send: jest.fn() };
  const request = { method: 'GET', originalUrl: '/materials/1', ip: '127.0.0.1' };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: () => undefined,
    }),
    getType: () => 'http',
    getArgs: () => [request, response],
    getArgByIndex: (index: number) => [request, response][index],
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { host: host as any, response, request };
};

const makeFilter = () => {
  const alerts = { notify: jest.fn().mockResolvedValue(undefined) } as unknown as TelegramAlertsService;
  // BaseExceptionFilter использует адаптер: reply + isHeadersSent (+ end на всякий случай).
  const adapter = { reply: jest.fn(), end: jest.fn(), isHeadersSent: jest.fn().mockReturnValue(false) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter = new AlertingExceptionFilter(adapter as any, alerts);
  return { filter, alerts, adapter };
};

describe('exceptionStatus', () => {
  it('HttpException отдаёт свой статус, остальное — 500', () => {
    expect(exceptionStatus(new BadRequestException('bad'))).toBe(400);
    expect(exceptionStatus(new NotFoundException())).toBe(404);
    expect(exceptionStatus(new Error('boom'))).toBe(500);
    expect(exceptionStatus('строка')).toBe(500);
  });
});

describe('AlertingExceptionFilter', () => {
  it('500 уходит в алерты и ответ формирует базовый фильтр', () => {
    const { filter, alerts, adapter } = makeFilter();
    const { host } = makeHost();

    filter.catch(new Error('boom'), host);

    expect(alerts.notify).toHaveBeenCalledTimes(1);
    const payload = (alerts.notify as jest.Mock).mock.calls[0][0];
    expect(payload.title).toContain('HTTP 500');
    expect(payload.title).toContain('/materials/1');
    expect(payload.details).toContain('boom');
    expect(payload.key).toContain('http500');
    expect(adapter.reply).toHaveBeenCalledTimes(1);
    expect((adapter.reply as jest.Mock).mock.calls[0][2]).toBe(500);
  });

  it('4xx не шумит в канал, но ответ по-прежнему уходит', () => {
    const { filter, alerts, adapter } = makeFilter();
    const { host } = makeHost();

    filter.catch(new BadRequestException('плохой запрос'), host);

    expect(alerts.notify).not.toHaveBeenCalled();
    expect(adapter.reply).toHaveBeenCalledTimes(1);
    expect((adapter.reply as jest.Mock).mock.calls[0][2]).toBe(400);
  });
});
