// backend/src/auth/password-policy.ts
// ⭐ №215: ЕДИНАЯ политика пароля. Одна функция на весь бэкенд (DTO + сервисы),
// те же правила продублированы на фронте (utils/password.ts) только ради подсказок.
// Причина: `123456` проходил регистрацию — аккаунт взламывался перебором.

export const PASSWORD_MIN_LENGTH = 8;

/** Подсказка для UI (регистрация, смена пароля). */
export const PASSWORD_RULE_TEXT = `Минимум ${PASSWORD_MIN_LENGTH} символов, хотя бы одна буква и одна цифра`;

/** Самые ходовые пароли — не пропускаем никогда (в нижнем регистре). */
const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '1234567',
  'password',
  'passw0rd',
  'password1',
  'qwerty',
  'qwerty123',
  'qwertyuiop',
  'abc12345',
  'iloveyou',
  'admin123',
  'welcome1',
  'letmein1',
  'football1',
  'пароль12',
  'йцукенгш',
]);

/**
 * Причина, по которой пароль не подходит, или null — если подходит.
 * Правила: длина ≥ 8, есть буква, есть цифра, не один повторяющийся символ,
 * не только цифры, не из списка популярных.
 */
export const passwordIssue = (password: unknown): string | null => {
  const value = String(password ?? '');
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов`;
  }
  if (!/[A-Za-zА-Яа-яЁё]/.test(value)) {
    return 'Пароль должен содержать хотя бы одну букву';
  }
  if (/^(.)\1+$/.test(value)) {
    return 'Пароль не должен состоять из одного повторяющегося символа';
  }
  if (!/\d/.test(value)) {
    return 'Пароль должен содержать хотя бы одну цифру';
  }
  if (/^\d+$/.test(value)) {
    return 'Пароль не должен состоять только из цифр';
  }
  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    return 'Такой пароль слишком простой — выберите другой';
  }
  return null;
};

/** Удобный булев вариант для UI/тестов. */
export const isPasswordStrong = (password: unknown): boolean => passwordIssue(password) === null;
