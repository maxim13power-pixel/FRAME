// backend/src/auth/org-access.guard.ts
// ⚠️ ВРЕМЕННАЯ ЗАГЛУШКА. Организация удалена из схемы.
// Файл будет полностью удалён на шаге 5 после чистки импортов в контроллерах.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class OrgAccessGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true; // реальная защита теперь в ObjectAccessGuard
  }
}