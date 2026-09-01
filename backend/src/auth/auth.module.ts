import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
imports: [
PassportModule,
JwtModule.register({
secret: process.env.JWT_SECRET || 'SECRET_KEY',
signOptions: { expiresIn: '1d' },
}),
PrismaModule,
],
controllers: [AuthController],
providers: [AuthService, JwtStrategy],
})
export class AuthModule {}