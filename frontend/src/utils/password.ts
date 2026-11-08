// frontend/src/utils/password.ts
// ⭐ №215: те же правила, что и на бэкенде (backend/src/auth/password-policy.ts),
// но только для мгновенной подсказки в форме. Финальное слово — за сервером.
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULE_TEXT = `Минимум ${PASSWORD_MIN_LENGTH} символов, хотя бы одна буква и одна цифра`;

/** Причина отказа или null, если пароль подходит (базовые правила). */
export const passwordIssue = (password: string): string | null => {
  const value = String(password ?? '');
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов`;
  }
  if (!/[A-Za-zА-Яа-яЁё]/.test(value)) return 'Пароль должен содержать хотя бы одну букву';
  if (/^(.)\1+$/.test(value)) return 'Пароль не должен состоять из одного символа';
  if (!/\d/.test(value)) return 'Пароль должен содержать хотя бы одну цифру';
  if (/^\d+$/.test(value)) return 'Пароль не должен состоять только из цифр';
  return null;
};
