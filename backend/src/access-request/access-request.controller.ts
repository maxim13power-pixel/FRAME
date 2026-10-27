// backend/src/access-request/access-request.controller.ts
// ⭐ №178: заявки на право создавать проекты в объекте
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AccessRequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessRequestService } from './access-request.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { ReviewAccessRequestDto } from './dto/review-access-request.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class AccessRequestController {
  constructor(private readonly accessRequestService: AccessRequestService) {}

  // POST /objects/:objectId/access-requests — подать заявку
  @Post('objects/:objectId/access-requests')
  create(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: CreateAccessRequestDto,
    @Req() req,
  ) {
    return this.accessRequestService.create(objectId, dto, req.user.userId);
  }

  // GET /objects/:objectId/access-requests — заявки объекта (менеджер/админ)
  @Get('objects/:objectId/access-requests')
  listForObject(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Req() req,
  ) {
    return this.accessRequestService.listForObject(objectId, req.user.userId);
  }

  // GET /access-requests?box=incoming|outgoing&status=PENDING
  @Get('access-requests')
  list(
    @Req() req,
    @Query('box') box?: string,
    @Query('status') status?: string,
  ) {
    const statusFilter =
      status && (Object.values(AccessRequestStatus) as string[]).includes(status)
        ? (status as AccessRequestStatus)
        : undefined;
    if (box === 'outgoing') {
      return this.accessRequestService.listOutgoing(req.user.userId);
    }
    return this.accessRequestService.listIncoming(req.user.userId, statusFilter);
  }

  // GET /access-requests/pending-count — бейдж «есть заявки»
  @Get('access-requests/pending-count')
  pendingCount(@Req() req) {
    return this.accessRequestService.pendingCount(req.user.userId);
  }

  // POST /access-requests/:id/approve — одобрить
  @Post('access-requests/:id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: ReviewAccessRequestDto,
    @Req() req,
  ) {
    return this.accessRequestService.approve(id, req.user.userId, dto.comment);
  }

  // POST /access-requests/:id/reject — отклонить
  @Post('access-requests/:id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: ReviewAccessRequestDto,
    @Req() req,
  ) {
    return this.accessRequestService.reject(id, req.user.userId, dto.comment);
  }

  // POST /access-requests/:id/cancel — отменить свою заявку
  @Post('access-requests/:id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.accessRequestService.cancel(id, req.user.userId);
  }
}
