// backend/src/projects/projects.service.spec.ts
// ⭐ №204 (A#10): карточка проекта — объектное право, а не проектное.
import { ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

const grant = (over: Record<string, unknown> = {}) => ({
  objectId: 15,
  projectId: null as number | null,
  role: 'FOREMAN',
  hidePrices: false,
  isManager: false,
  isHidden: false,
  revokedAt: null as Date | null,
  ...over,
});

describe('ProjectsService — карточка проекта (№204, A#10)', () => {
  const prisma = {
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    objectAccess: { findMany: jest.fn() },
    material: { count: jest.fn() },
    report: { count: jest.fn() },
    warehouseTransaction: { count: jest.fn() },
    brigadeShift: { count: jest.fn() },
  };
  const audit = { log: jest.fn() };
  let service: ProjectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.project.findUnique.mockResolvedValue({ objectId: 15 });
    prisma.project.update.mockResolvedValue({ id: 29 });
    prisma.project.delete.mockResolvedValue({ id: 29 });
    prisma.material.count.mockResolvedValue(0);
    prisma.report.count.mockResolvedValue(0);
    prisma.warehouseTransaction.count.mockResolvedValue(0);
    prisma.brigadeShift.count.mockResolvedValue(0);
    audit.log.mockResolvedValue(undefined);
    service = new ProjectsService(prisma as never, audit as never);
  });

  it('участник ОДНОГО проекта не может переименовать проект ⇒ Forbidden', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([grant({ projectId: 29 })]);

    await expect(service.update(29, { name: 'Новое имя' }, 7)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('наблюдатель на всём объекте карточку не меняет ⇒ Forbidden', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([grant({ role: 'VIEWER' })]);

    await expect(service.update(29, { name: 'Новое имя' }, 7)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('участник всего объекта с правом записи меняет карточку', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([grant()]);
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 29 } as never);

    await expect(service.update(29, { name: 'Новое имя' }, 7)).resolves.toBeTruthy();
    expect(prisma.project.update).toHaveBeenCalled();
  });

  it('прораб без isManager не удаляет проект ⇒ Forbidden (удаление — право администратора)', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([grant()]);

    await expect(service.remove(29, 7)).rejects.toThrow(ForbiddenException);
    expect(prisma.project.delete).not.toHaveBeenCalled();
  });

  it('администратор объекта удаляет пустой проект', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([grant({ role: 'CUSTOMER' })]);

    await expect(service.remove(29, 7)).resolves.toBeTruthy();
    expect(prisma.project.delete).toHaveBeenCalled();
  });
});
