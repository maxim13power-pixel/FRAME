import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../../prisma/prisma.module';
import { CaptchaModule } from '../captcha'; // ⭐ НОВОЕ
import { EmailService } from './email.service'; // ⭐ P0-4
function getJwtSecret(): string {
const secret = process.env.JWT_SECRET?.trim();

if (!secret) {
throw new Error('JWT_SECRET is not set');
}

return secret;
}

@Module({
imports: [
PassportModule,
CaptchaModule,
JwtModule.register({
secret: getJwtSecret(),
signOptions: { expiresIn: '1d' },
}),
PrismaModule,
],
controllers: [AuthController],
providers: [AuthService, JwtStrategy, EmailService],
})
export class AuthModule {}