import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

// Временное хранилище пользователей (потом заменим на БД)
const users = [
  {
    id: 1,
    name: 'Козлов Максим Валерьевич',
    phone: '+79277151256',
    password: '$2b$10$fR5yZZJUlmOkKPO18N2.pO2g6nGSOoQI8PSCkILI77sKy.6joQlhi', // позже сгенерируем хеш admin123
    role: 'Администратор',
  },
];

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateUser(phone: string, pass: string): Promise<any> {
    const user = users.find(u => u.phone === phone);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { sub: user.id, phone: user.phone, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    };
  }
}