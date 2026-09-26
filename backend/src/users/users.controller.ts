// backend/src/users/users.controller.ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
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
}
