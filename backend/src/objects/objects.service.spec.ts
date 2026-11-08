// backend/src/objects/objects.service.spec.ts
// ⭐ №181: создатель объекта всегда администратор — роль из запроса игнорируется.
import { ObjectsService } from './objects.service';
import { CreateObjectDto } from './dto/create-object.dto';

describe('ObjectsService — создание объекта (№181)', () => {
  const prisma = { object: { create: jest.fn() } };
  let service: ObjectsService;

  const dto = {
    name: 'Объект',
    address: 'Адрес',
    startDate: '2026-01-01',
    endDate: '2026-06-01',
  } as CreateObjectDto;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ObjectsService(prisma as any);
    prisma.object.create.mockResolvedValue({ id: 1, name: 'Объект' });
  });

  it('создатель получает доступ CUSTOMER (администратор объекта)', async () => {
    await service.create(dto, 7);

    const data = prisma.object.create.mock.calls[0][0].data;
    expect(data.accesses.create).toEqual({
      userId: 7,
      role: 'CUSTOMER',
      canCreateProjects: true, // ⭐ №207
    });
  });

  it('роль из запроса игнорируется — прораб тоже становится администратором', async () => {
    await service.create({ ...dto, role: 'FOREMAN' } as any, 7);

    const data = prisma.object.create.mock.calls[0][0].data;
    expect(data.accesses.create.role).toBe('CUSTOMER');
    expect(data.accesses.create.canCreateProjects).toBe(true);
  });
});


describe('ObjectsService — управление объектом (№220)', () => {
  const objectUpdate = jest.fn();
  const priceCatalog = { findFirst: jest.fn() };

  const build = (role: 'FOREMAN' | 'CUSTOMER' | 'VIEWER', hidePrices = false) => {
    const prisma = {
      object: { update: objectUpdate },
      objectAccess: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              id: 1,
              objectId: 1,
              projectId: null,
              role,
              hidePrices,
              canCreateProjects: false,
              isHidden: false,
              revokedAt: null,
            },
          ]),
      },
      priceCatalog,
    };
    return { service: new ObjectsService(prisma as any), prisma };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    objectUpdate.mockResolvedValue({ id: 1, name: 'Объект' });
    priceCatalog.findFirst.mockResolvedValue({ id: 18 });
  });

  it('прораб может менять имя, адрес и ДАТЫ объекта', async () => {
    const { service } = build('FOREMAN');

    await service.update(1, { name: 'Новое имя', endDate: '2027-01-01' }, 7);

    expect(objectUpdate).toHaveBeenCalled();
  });

  it('прораб, которому доверяют цены, может сменить справочник', async () => {
    const { service } = build('FOREMAN', false);

    await service.update(1, { catalogId: 18 }, 7);

    expect(objectUpdate).toHaveBeenCalled();
  });

  it('прораб со скрытыми ценами НЕ может сменить справочник', async () => {
    const { service } = build('FOREMAN', true);

    await expect(service.update(1, { catalogId: 18 }, 7)).rejects.toThrow(/скрыты цены/);
    expect(objectUpdate).not.toHaveBeenCalled();
  });

  it('наблюдатель не может менять объект вообще', async () => {
    const { service } = build('VIEWER');

    await expect(service.update(1, { name: 'X' }, 7)).rejects.toThrow();
    expect(objectUpdate).not.toHaveBeenCalled();
  });

  it('продление объекта (PATCH end-date) прорабом разрешено — нужен флоу проектов', async () => {
    const { service } = build('FOREMAN');

    await service.updateEndDate(1, '2027-01-01', 7);

    expect(objectUpdate).toHaveBeenCalled();
  });

  it('пустая/битая дата окончания — 400, а не 500', async () => {
    const { service } = build('CUSTOMER');

    await expect(service.updateEndDate(1, '', 7)).rejects.toThrow(/ГГГГ-ММ-ДД/);
    await expect(service.updateEndDate(1, 'не-дата', 7)).rejects.toThrow(/ГГГГ-ММ-ДД/);
    expect(objectUpdate).not.toHaveBeenCalled();
  });
});
