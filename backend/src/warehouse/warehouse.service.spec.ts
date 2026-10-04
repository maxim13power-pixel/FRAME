// backend/src/warehouse/warehouse.service.spec.ts
// ⭐ №126: unit-тесты складской атомарности (Блок A) и доступа к чужому объекту (Блок C).
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

describe('WarehouseService', () => {
  // Транзакционный клиент (tx), который $transaction передаёт в колбэк.
  const tx = {
    warehouseItem: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    warehouseTransaction: { create: jest.fn() },
  };

  // Мок PrismaService (внешний клиент).
  const prisma = {
    warehouseItem: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    objectAccess: { findFirst: jest.fn(), findMany: jest.fn() },
    warehouseTransaction: { create: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  let service: WarehouseService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((cb: any) => cb(tx));
    service = new WarehouseService(prisma as any);
  });

  describe('createTransaction — складская атомарность (Блок A)', () => {
    const userId = 7;

    beforeEach(() => {
      // checkItemAccess: позиция существует и «общая» (objectId = null).
      prisma.warehouseItem.findUnique.mockResolvedValue({ id: 1, objectId: null });
      // checkProjectAccess (для expense/write-off): проект найден, доступ есть.
      prisma.project.findUnique.mockResolvedValue({ objectId: 2 });
      prisma.objectAccess.findFirst.mockResolvedValue({
        id: 1,
        role: 'FOREMAN',
        hidePrices: false,
      });
      // Внутри транзакции позиция существует.
      tx.warehouseItem.findUnique.mockResolvedValue({ id: 1 });
    });

    it('expense: updateMany count=0 ⇒ BadRequestException и транзакция не создаётся', async () => {
      tx.warehouseItem.updateMany.mockResolvedValue({ count: 0 });

      const dto = {
        warehouseItemId: 1,
        type: 'expense',
        quantity: 5,
        projectId: 10,
      } as CreateTransactionDto;

      const promise = service.createTransaction(userId, dto);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        'Нельзя списать больше, чем есть на складе',
      );

      expect(tx.warehouseTransaction.create).not.toHaveBeenCalled();
    });

    it('expense: updateMany count=1 ⇒ создаётся транзакция с decrement', async () => {
      tx.warehouseItem.updateMany.mockResolvedValue({ count: 1 });
      tx.warehouseTransaction.create.mockResolvedValue({ id: 100, type: 'expense' });

      const dto = {
        warehouseItemId: 1,
        type: 'expense',
        quantity: 5,
        projectId: 10,
      } as CreateTransactionDto;

      const result = await service.createTransaction(userId, dto);

      expect(result).toEqual({ id: 100, type: 'expense' });
      expect(tx.warehouseItem.updateMany).toHaveBeenCalledWith({
        where: { id: 1, quantity: { gte: 5 } },
        data: { quantity: { decrement: 5 } },
      });
      expect(tx.warehouseTransaction.create).toHaveBeenCalledWith({
        data: {
          warehouseItemId: 1,
          type: 'expense',
          quantity: 5,
          price: null,
          projectId: 10,
          comment: null,
          createdBy: userId,
        },
      });
    });

    it('income: increment без updateMany', async () => {
      tx.warehouseItem.update.mockResolvedValue({ id: 1 });
      tx.warehouseTransaction.create.mockResolvedValue({ id: 101, type: 'income' });

      const dto = {
        warehouseItemId: 1,
        type: 'income',
        quantity: 3,
      } as CreateTransactionDto;

      const result = await service.createTransaction(userId, dto);

      expect(result).toEqual({ id: 101, type: 'income' });
      expect(tx.warehouseItem.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { quantity: { increment: 3 } },
      });
      expect(tx.warehouseItem.updateMany).not.toHaveBeenCalled();
      expect(tx.warehouseTransaction.create).toHaveBeenCalledWith({
        data: {
          warehouseItemId: 1,
          type: 'income',
          quantity: 3,
          price: null,
          projectId: null,
          comment: null,
          createdBy: userId,
        },
      });
    });
  });

  describe('доступ — чужой объект (Блок C)', () => {
    it('list с objectId чужого объекта ⇒ ForbiddenException', async () => {
      prisma.objectAccess.findFirst.mockResolvedValue(null);

      const promise = service.list(7, 999);
      await expect(promise).rejects.toThrow(ForbiddenException);
      await expect(promise).rejects.toThrow('Нет доступа к этому объекту');
    });
  });
});
