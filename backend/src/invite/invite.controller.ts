import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InviteService } from './invite.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@Controller()
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  // ⭐ Авторизованные эндпоинты (требуют JWT)

  // POST /objects/:objectId/invite-link — создать ссылку
  @Post('objects/:objectId/invite-link')
  @UseGuards(JwtAuthGuard)
  createInvite(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: CreateInviteDto,
    @Req() req,
  ) {
    return this.inviteService.createInviteLink(objectId, dto, req.user.userId);
  }

  // GET /objects/:objectId/invite-links — список активных ссылок
  @Get('objects/:objectId/invite-links')
  @UseGuards(JwtAuthGuard)
  getInviteLinks(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Req() req,
    @Query('projectId') projectId?: string,
  ) {
    const parsed =
      projectId && projectId.trim() !== '' ? Number(projectId) : undefined;
    return this.inviteService.getInviteLinks(
      objectId,
      req.user.userId,
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  // DELETE /objects/:objectId/invite-links/:id — отозвать ссылку
  @Delete('objects/:objectId/invite-links/:id')
  @UseGuards(JwtAuthGuard)
  revokeInvite(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
  ) {
    return this.inviteService.revokeInviteLink(objectId, id, req.user.userId);
  }

  // POST /invite/:token/accept — принять приглашение (авторизованный)
  // ⭐ №341: confirmDowngrade — явное подтверждение, если ссылка понижает роль
  @Post('invite/:token/accept')
  @UseGuards(JwtAuthGuard)
  acceptInvite(
    @Param('token') token: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: AcceptInviteDto,
    @Req() req,
  ) {
    return this.inviteService.acceptInvite(token, req.user.userId, {
      confirmDowngrade: dto?.confirmDowngrade === true,
    });
  }

  // GET /invite/:token/status — ⭐ №341: что будет, если я приму ссылку
  // (уже есть доступ / понижение роли). Только для авторизованных.
  @Get('invite/:token/status')
  @UseGuards(JwtAuthGuard)
  inviteStatus(@Param('token') token: string, @Req() req) {
    return this.inviteService.inviteStatus(token, req.user.userId);
  }

  // ⭐ Публичный эндпоинт (НЕ требует JWT)

  // GET /invite/:token — информация о приглашении (для страницы принятия)
  @Get('invite/:token')
  getInviteInfo(@Param('token') token: string) {
    return this.inviteService.getInviteByToken(token);
  }
}
