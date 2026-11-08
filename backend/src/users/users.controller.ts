// backend/src/users/users.controller.ts
import { Body, Controller, Delete, Get, Patch, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
  // ⭐ №215: правка своего профиля — имя и телефон (email/роль не меняются)
  @Patch('me')
  updateMe(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateProfileDto,
    @Req() req,
  ) {
    return this.usersService.updateMyProfile(req.user.userId, dto);
  }

  @Delete('me')
  deleteMe(@Req() req) {
    return this.usersService.deleteMe(req.user.userId);
  }
}
