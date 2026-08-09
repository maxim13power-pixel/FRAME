// backend/src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // можно сделать глобальным, чтобы не импортировать везде
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}