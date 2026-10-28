// backend/src/users/users.service.spec.ts
// ⭐ №184: «Моя команда» показывает объекты и с доступом «только проект»,
// но членов команды — только по моим проектам (приватность контактов).
import { UsersService } from './users.service';

describe('UsersService.getTeam — «Моя команда» (№184)', () => {
  const prisma = {
    objectAccess: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
  };
  let service: UsersService;

  const obj = {
    id: 15,
    name: 'ЖК Северный парк',
    address: 'ул. Строителей, 2',
    isArchived: false,
    createdAt: new Date('2026-01-02'),
  };

  const member = (id: number, projectId: number | null, role = 'FOREMAN') => ({
    id,
    userId: 100 + id,
    objectId: 15,
    projectId,
    role,
    hidePrices: false,
    invitedBy: null,
    createdAt: new Date('2026-01-03'),
    user: { id: 100 + id, fullName: `User ${id}`, email: null, phone: null },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma as any);
  });

  it('доступ только к проекту ⇒ объект виден, scope = имя проекта', async () => {
    prisma.objectAccess.findMany
      .mockResolvedValueOnce([
        { id: 1, objectId: 15, projectId: 29, role: 'FOREMAN', object: obj },
      ])
      .mockResolvedValueOnce([member(1, 29), member(2, 29)]);
    prisma.project.findMany.mockResolvedValue([{ id: 29, name: 'Монолит' }]);

    const res: any = await service.getTeam(20);

    expect(res).toHaveLength(1);
    expect(res[0].scopes).toEqual(['Монолит']);
    expect(res[0].myRole).toBe('FOREMAN');
    // участники — только моего проекта (в моке оба из 29)
    expect(res[0].members).toHaveLength(2);
    // название проекта запрашивалось только по моим проектам
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [29] } } }),
    );
  });

  it('объектный доступ ⇒ scope «Весь объект»', async () => {
    prisma.objectAccess.findMany
      .mockResolvedValueOnce([
        { id: 1, objectId: 15, projectId: null, role: 'CUSTOMER', object: obj },
      ])
      .mockResolvedValueOnce([member(1, null, 'CUSTOMER')]);

    const res: any = await service.getTeam(18);

    expect(res[0].scopes).toEqual(['Весь объект']);
    expect(res[0].myRole).toBe('CUSTOMER');
    // проекты не запрашиваются, если проектных доступов нет
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });

  it('доступов нет ⇒ пустой список', async () => {
    prisma.objectAccess.findMany.mockResolvedValueOnce([]);

    await expect(service.getTeam(99)).resolves.toEqual([]);
  });
});
