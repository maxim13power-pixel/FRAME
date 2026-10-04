// frontend/src/services/auditService.ts
// ⭐ №131: чтение журнала изменений.
import api from './api';

export interface AuditActor {
  id: number;
  fullName?: string;
  email?: string | null;
}

export interface AuditLogEntry {
  id: number;
  actorId: number;
  entity: string;
  entityId: number;
  action: string;
  before: unknown;
  after: unknown;
  createdAt: string;
  actor?: AuditActor;
}

export const fetchAuditLog = async (
  entity: string,
  entityId: number
): Promise<AuditLogEntry[]> => {
  const response = await api.get('/audit', { params: { entity, entityId } });
  return response.data;
};
