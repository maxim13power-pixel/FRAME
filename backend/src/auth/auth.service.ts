import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service'; // ⚠️ замените на реальный путь

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prismaService: PrismaService,
  ) {}

  async validateUser(phone: string, pass: string): Promise<any> {
    const user = await this.prismaService.user.findUnique({
      where: { phone },
    });

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, rememberMe: boolean = false) {
    const payload = { sub: user.id, phone: user.phone, role: user.role };
    const expiresIn = rememberMe ? '30d' : '1d';
    console.log('rememberMe:', rememberMe, 'expiresIn:', expiresIn); // добавим для отладки
    const access_token = this.jwtService.sign(payload, { expiresIn });
    return {
      access_token,
      user: {
        id: user.id,
        name: user.fullName, // ⚠️ проверьте точное название поля в вашей модели (может быть name)
        phone: user.phone,
        role: user.role,
      },
    };
  }
}