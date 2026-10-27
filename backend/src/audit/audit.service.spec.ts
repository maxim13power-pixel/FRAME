// backend/src/audit/audit.service.spec.ts
// ⭐ №180: журнал всей системы без области — только ADMIN; остальным нужен entity + entityId.
import { ForbiddenException } from '@nestjs/common';
import { AuditService } from './audit.service';

describe('AuditService — чтение журнала (№180)', () => {
  const prisma = {
    auditLog: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    report: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    objectAccess: { findFirst: jest.fn() },
  };

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(prisma as any);
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it('без entity/entityId и не ADMIN ⇒ ForbiddenException', async () => {
    await expect(
      service.list(7, undefined, undefined, 'FOREMAN'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('без entity/entityId но ADMIN ⇒ журнал читается', async () => {
    await service.list(1, undefined, undefined, 'ADMIN');

    expect(prisma.auditLog.findMany).toHaveBeenCalled();
  });

  it('entity+entityId чужого проекта ⇒ ForbiddenException', async () => {
    prisma.report.findUnique.mockResolvedValue({ id: 5, projectId: 3 });
    prisma.project.findUnique.mockResolvedValue({ objectId: 2 });
    prisma.objectAccess.findFirst.mockResolvedValue(null);

    await expect(service.list(7, 'report', 5, 'FOREMAN')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('entity+entityId своего проекта ⇒ журнал читается', async () => {
    prisma.report.findUnique.mockResolvedValue({ id: 5, projectId: 3 });
    prisma.project.findUnique.mockResolvedValue({ objectId: 2 });
    prisma.objectAccess.findFirst.mockResolvedValue({
      id: 1,
      role: 'FOREMAN',
    });

    await service.list(7, 'report', 5, 'FOREMAN');

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { entity: 'report', entityId: 5 } }),
    );
  });
});
