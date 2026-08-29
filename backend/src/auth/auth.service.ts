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

async validateUser(login: string, pass: string): Promise<any> {
  // ⭐ Фича: принимаем и email и телефон (удобно для пользователей)
  const isEmail = login.includes('@');
  const user = await this.prismaService.user.findFirst({
    where: isEmail ? { email: login } : { phone: login },
  });
  if (user && (await bcrypt.compare(pass, user.password))) {
    const { password, ...result } = user;
    return result;
  }
  return null;
}
  async login(user: any, rememberMe: boolean = false) {
    // ⭐ 6.8: подтягиваем membership'ы юзера → первая = "текущая организация"
    const memberships = await this.prismaService.orgMembership.findMany({
      where: { userId: user.id },
      include: { org: true },
      orderBy: { createdAt: 'asc' },
    });
    const currentMembership = memberships[0];
    const payload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      orgId: currentMembership?.orgId ?? null,
      orgRole: currentMembership?.role ?? null,
    };
    const expiresIn = rememberMe ? '30d' : '1d';
    console.log('rememberMe:', rememberMe, 'expiresIn:', expiresIn);
    const access_token = this.jwtService.sign(payload, { expiresIn });
    return {
      access_token,
      user: {
        id: user.id,
        name: user.fullName,
        phone: user.phone,
        role: user.role,
        orgId: currentMembership?.orgId ?? null,
        orgRole: currentMembership?.role ?? null,
      },
    };
  }
}