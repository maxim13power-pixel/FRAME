// backend/src/snapshots/snapshots.controller.ts
// ⭐ №194: личное пространство «Мои снимки доступа». Доступ — только владельцу,
// поэтому здесь нет ObjectAccessGuard: объекта уже нет в живых правах.
import { Controller, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SnapshotsService } from './snapshots.service';

@Controller('me/snapshots')
@UseGuards(JwtAuthGuard)
export class SnapshotsController {
  constructor(private readonly snapshots: SnapshotsService) {}

  @Get()
  listMine(@Req() req) {
    return this.snapshots.listMine(req.user.userId);
  }

  @Get(':id')
  getMine(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.snapshots.getMine(req.user.userId, id);
  }
}
