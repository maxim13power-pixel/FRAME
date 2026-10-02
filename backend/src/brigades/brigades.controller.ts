// backend/src/brigades/brigades.controller.ts
// ⭐ Срез 4: бригады — учёт выходов и выработки.
import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req,
  UseGuards, ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BrigadesService } from './brigades.service';
import { CreateBrigadeDto } from './dto/create-brigade.dto';
import { UpdateBrigadeDto } from './dto/update-brigade.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { LogShiftDto } from './dto/log-shift.dto';

@Controller('brigades')
@UseGuards(JwtAuthGuard)
export class BrigadesController {
  constructor(private readonly brigadesService: BrigadesService) {}

  @Get()
  list(@Req() req, @Query('objectId') objectId?: string, @Query('search') search?: string) {
    const oid = objectId === undefined || objectId === '' ? undefined : Number(objectId);
    return this.brigadesService.list(req.user.userId, oid, search);
  }

  @Get(':id')
  detail(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.brigadesService.detail(req.user.userId, id);
  }

  @Post()
  create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: CreateBrigadeDto,
    @Req() req,
  ) {
    return this.brigadesService.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: UpdateBrigadeDto,
    @Req() req,
  ) {
    return this.brigadesService.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.brigadesService.remove(req.user.userId, id);
  }

  @Post(':id/members')
  addMember(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: AddMemberDto,
    @Req() req,
  ) {
    return this.brigadesService.addMember(req.user.userId, id, dto);
  }

  @Delete(':id/members/:mid')
  removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('mid', ParseIntPipe) mid: number,
    @Req() req,
  ) {
    return this.brigadesService.removeMember(req.user.userId, id, mid);
  }

  @Get(':id/shifts')
  listShifts(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('projectId') projectId?: string,
  ) {
    const pid = projectId === undefined || projectId === '' ? undefined : Number(projectId);
    return this.brigadesService.listShifts(req.user.userId, id, from, to, pid);
  }

  @Post(':id/shifts')
  logShift(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: LogShiftDto,
    @Req() req,
  ) {
    return this.brigadesService.logShift(req.user.userId, id, dto);
  }

  @Patch(':id/shifts/:sid')
  updateShift(
    @Param('id', ParseIntPipe) id: number,
    @Param('sid', ParseIntPipe) sid: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: LogShiftDto,
    @Req() req,
  ) {
    return this.brigadesService.updateShift(req.user.userId, id, sid, dto);
  }

  @Delete(':id/shifts/:sid')
  removeShift(
    @Param('id', ParseIntPipe) id: number,
    @Param('sid', ParseIntPipe) sid: number,
    @Req() req,
  ) {
    return this.brigadesService.removeShift(req.user.userId, id, sid);
  }

  @Get(':id/stats')
  stats(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.brigadesService.stats(req.user.userId, id);
  }
}
