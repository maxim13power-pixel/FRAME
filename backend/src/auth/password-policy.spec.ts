// backend/src/auth/password-policy.spec.ts
// ⭐ №215: слабые пароли (в т.ч. «123456») не должны проходить регистрацию.
import { isPasswordStrong, passwordIssue } from './password-policy';

describe('passwordIssue (№215)', () => {
  it('короткий пароль не проходит', () => {
    expect(passwordIssue('123456')).toBe('Пароль должен быть не короче 8 символов');
    expect(passwordIssue('Ab1')).toMatch(/8 символов/);
  });

  it('только цифры не проходят (в т.ч. длинные)', () => {
    expect(passwordIssue('123456789')).toMatch(/хотя бы одну букву/);
    expect(passwordIssue('9876543210123')).toMatch(/хотя бы одну букву/);
  });

  it('только буквы не проходят', () => {
    expect(passwordIssue('abcdefgh')).toMatch(/хотя бы одну цифру/);
  });

  it('один повторяющийся символ не проходит', () => {
    expect(passwordIssue('aaaaaaaa')).toMatch(/одного повторяющегося/);
  });

  it('популярный пароль не проходит, даже если формально длинный', () => {
    expect(passwordIssue('qwerty123')).toMatch(/слишком простой/);
    expect(passwordIssue('Password1')).toMatch(/слишком простой/);
  });

  it('нормальные пароли проходят', () => {
    expect(passwordIssue('pro2345rab')).toBeNull();
    expect(passwordIssue('Стройка2026')).toBeNull();
    expect(isPasswordStrong('Marina2026!')).toBe(true);
  });

  it('пустое значение трактуется как слишком короткое', () => {
    expect(passwordIssue(undefined)).toMatch(/8 символов/);
    expect(isPasswordStrong(null)).toBe(false);
  });
});
