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
