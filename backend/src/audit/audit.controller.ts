// backend/src/audit/audit.controller.ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @Req() req,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.auditService.list(
      req.user.userId,
      entity,
      entityId != null ? Number(entityId) : undefined,
    );
  }
}
