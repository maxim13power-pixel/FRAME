// frontend/src/utils/jwt.ts
// ⭐ №160: чтение полезной нагрузки JWT на клиенте (без верификации подписи —
// только для UI: «сессия активна до …», срок действия токена).
export interface JwtPayloadLite {
  sub?: number;
  role?: string;
  exp?: number; // unix-время в секундах
  iat?: number;
}

/** Декодирует payload JWT. Возвращает null для битого/отсутствующего токена. */
export const decodeJwt = (token: string | null): JwtPayloadLite | null => {
  if (!token) return null;
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
    // payload содержит только ASCII-поля, поэтому atob достаточно
    return JSON.parse(atob(normalized)) as JwtPayloadLite;
  } catch {
    return null;
  }
};

/** Дата истечения токена (или null, если токена/exp нет). */
export const getTokenExpiry = (token: string | null): Date | null => {
  const payload = decodeJwt(token);
  return payload?.exp ? new Date(payload.exp * 1000) : null;
};
