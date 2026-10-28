// backend/src/snapshots/snapshot-payload.ts
// ⭐ №194 (F1 шаг 2): неизменяемый слепок данных объекта на момент отзыва доступа.
// Собирается ОДИН раз внутри транзакции отзыва и больше не меняется: экран
// «Снимок доступа» читает только эту строку, живые таблицы не трогает.
// Если участнику были скрыты цены (VIEWER / hidePrices), деньги в слепок не попадают.
import { Prisma } from '@prisma/client';

export interface SnapshotScopeInput {
  objectId: number;
  /** null — доступ был на весь объект, иначе только на этот проект */
  projectId: number | null;
  hidePrices: boolean;
  takenAt: Date;
}

export interface SnapshotSummary {
  projects: number;
  materials: number;
  reports: number;
  warehouseItems: number;
  warehouseTransactions: number;
  brigades: number;
  shifts: number;
}

export interface SnapshotBuildResult {
  objectName: string;
  projectName: string | null;
  summary: SnapshotSummary;
  payload: Prisma.InputJsonValue;
}

const num = (value: Prisma.Decimal | null | undefined): number | null =>
  value == null ? null : Number(value);

const iso = (value: Date | null | undefined): string | null =>
  value == null ? null : value.toISOString();

/**
 * Собирает слепок: объект, проекты (в рамках доступа), сметы, акты,
 * склад объекта, бригады с составом и выходами.
 */
export async function buildSnapshotPayload(
  tx: Prisma.TransactionClient,
  input: SnapshotScopeInput,
): Promise<SnapshotBuildResult | null> {
  const { objectId, projectId, hidePrices, takenAt } = input;
  const projectFilter = projectId != null ? { id: projectId } : {};

  const object = await tx.object.findUnique({
    where: { id: objectId },
    select: {
      id: true,
      name: true,
      address: true,
      startDate: true,
      endDate: true,
      plannedEndDate: true,
      note: true,
    },
  });
  if (!object) {
    // Объект уже удалён — снимать нечего; отзыв доступа из-за этого не падает.
    return null;
  }

  const projects = await tx.project.findMany({
    where: { objectId, ...projectFilter },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      note: true,
      materials: {
        orderBy: { id: 'asc' },
        select: {
          name: true,
          article: true,
          unit: true,
          specQuantity: true,
          totalUsed: true,
          lastEntryDate: true,
          isSpecLocked: true,
          note: true,
          unitPrice: true,
          materialUnitPrice: true,
        },
      },
    },
  });

  const reportFilter: Prisma.ReportWhereInput = { objectId };
  if (projectId != null) reportFilter.projectId = projectId;

  const reports = await tx.report.findMany({
    where: reportFilter,
    orderBy: { id: 'asc' },
    select: {
      id: true,
      projectId: true,
      type: true,
      title: true,
      status: true,
      totalAmount: true,
      comment: true,
      createdAt: true,
      items: {
        orderBy: { sortOrder: 'asc' },
        select: { name: true, unit: true, quantity: true, price: true, total: true },
      },
    },
  });

  // Склад: только позиции этого объекта. «Общие» позиции (objectId = null)
  // ничьи — в снимок участника не попадают (см. A#2 аудита).
  const warehouseItems = await tx.warehouseItem.findMany({
    where: { objectId },
    orderBy: { id: 'asc' },
    select: {
      name: true,
      unit: true,
      category: true,
      quantity: true,
      price: true,
      comment: true,
    },
  });

  const warehouseTransactions = await tx.warehouseTransaction.findMany({
    where: { warehouseItem: { objectId } },
    orderBy: { createdAt: 'asc' },
    select: {
      type: true,
      quantity: true,
      price: true,
      comment: true,
      createdAt: true,
      warehouseItem: { select: { name: true } },
      project: { select: { name: true } },
    },
  });

  const brigades = await tx.brigade.findMany({
    where: { objectId },
    orderBy: { id: 'asc' },
    select: {
      name: true,
      specialty: true,
      foremanName: true,
      phone: true,
      comment: true,
      members: {
        orderBy: { id: 'asc' },
        select: { fullName: true, role: true, phone: true },
      },
      shifts: {
        orderBy: { date: 'asc' },
        select: {
          date: true,
          hoursWorked: true,
          outputValue: true,
          outputArea: true,
          comment: true,
          project: { select: { name: true } },
          members: { select: { fullName: true, hours: true } },
        },
      },
    },
  });

  // ─── Скрытие денег: тот же принцип, что в живых разделах ───
  const money = <T>(value: T): T | null => (hidePrices ? null : value);

  const summary: SnapshotSummary = {
    projects: projects.length,
    materials: projects.reduce((sum, p) => sum + p.materials.length, 0),
    reports: reports.length,
    warehouseItems: warehouseItems.length,
    warehouseTransactions: warehouseTransactions.length,
    brigades: brigades.length,
    shifts: brigades.reduce((sum, b) => sum + b.shifts.length, 0),
  };

  const payload = {
    version: 1,
    takenAt: takenAt.toISOString(),
    scope: { objectId, projectId, hidePrices },
    object: {
      id: object.id,
      name: object.name,
      address: object.address,
      startDate: iso(object.startDate),
      endDate: iso(object.endDate),
      plannedEndDate: iso(object.plannedEndDate),
      note: object.note,
    },
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      startDate: iso(p.startDate),
      endDate: iso(p.endDate),
      note: p.note,
      materials: p.materials.map((m) => ({
        name: m.name,
        article: m.article,
        unit: m.unit,
        specQuantity: num(m.specQuantity),
        totalUsed: num(m.totalUsed),
        lastEntryDate: iso(m.lastEntryDate),
        isSpecLocked: m.isSpecLocked,
        note: m.note,
        unitPrice: money(num(m.unitPrice)),
        materialUnitPrice: money(num(m.materialUnitPrice)),
      })),
    })),
    reports: reports.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      type: r.type,
      title: r.title,
      status: r.status,
      createdAt: iso(r.createdAt),
      comment: r.comment,
      totalAmount: money(num(r.totalAmount)),
      items: r.items.map((i) => ({
        name: i.name,
        unit: i.unit,
        quantity: num(i.quantity),
        price: money(num(i.price)),
        total: money(num(i.total)),
      })),
    })),
    warehouse: {
      items: warehouseItems.map((i) => ({
        name: i.name,
        unit: i.unit,
        category: i.category,
        quantity: num(i.quantity),
        price: money(num(i.price)),
        comment: i.comment,
      })),
      transactions: warehouseTransactions.map((t) => ({
        type: t.type,
        quantity: num(t.quantity),
        price: money(num(t.price)),
        comment: t.comment,
        createdAt: iso(t.createdAt),
        itemName: t.warehouseItem.name,
        projectName: t.project?.name ?? null,
      })),
    },
    brigades: brigades.map((b) => ({
      name: b.name,
      specialty: b.specialty,
      foremanName: b.foremanName,
      phone: b.phone,
      comment: b.comment,
      members: b.members,
      shifts: b.shifts.map((s) => ({
        date: iso(s.date),
        hoursWorked: num(s.hoursWorked),
        outputValue: money(num(s.outputValue)),
        outputArea: num(s.outputArea),
        comment: s.comment,
        projectName: s.project?.name ?? null,
        members: s.members.map((m) => ({ fullName: m.fullName, hours: num(m.hours) })),
      })),
    })),
  };

  return {
    objectName: object.name,
    projectName: projects.length === 1 && projectId != null ? projects[0].name : null,
    summary,
    payload: payload as unknown as Prisma.InputJsonValue,
  };
}
