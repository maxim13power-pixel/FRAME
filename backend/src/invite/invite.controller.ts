import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InviteService } from './invite.service';
import { CreateInviteDto } from './dto/create-invite.dto';

@Controller()
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  // ⭐ Авторизованные эндпоинты (требуют JWT)

  // POST /objects/:objectId/invite-link — создать ссылку
  @Post('objects/:objectId/invite-link')
  @UseGuards(JwtAuthGuard)
  createInvite(
    @Param('objectId', ParseIntPipe) objectId: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: CreateInviteDto,
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
  ) {
    return this.inviteService.getInviteLinks(objectId, req.user.userId);
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
  @Post('invite/:token/accept')
  @UseGuards(JwtAuthGuard)
  acceptInvite(
    @Param('token') token: string,
    @Req() req,
  ) {
    return this.inviteService.acceptInvite(token, req.user.userId);
  }

  // ⭐ Публичный эндпоинт (НЕ требует JWT)

  // GET /invite/:token — информация о приглашении (для страницы принятия)
  @Get('invite/:token')
  getInviteInfo(@Param('token') token: string) {
    return this.inviteService.getInviteByToken(token);
  }
}