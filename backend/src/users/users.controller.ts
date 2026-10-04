// backend/src/users/users.controller.ts
import { Controller, Delete, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/team — сводный список участников по всем моим объектам
  @Get('team')
  getTeam(@Req() req) {
    return this.usersService.getTeam(req.user.userId);
  }

  // ⭐ №130 (152-ФЗ): выгрузка своих персональных данных
  @Get('me/export')
  exportMyData(@Req() req) {
    return this.usersService.exportMyData(req.user.userId);
  }

  // ⭐ №130 (152-ФЗ): удаление аккаунта
  @Delete('me')
  deleteMe(@Req() req) {
    return this.usersService.deleteMe(req.user.userId);
  }
}
