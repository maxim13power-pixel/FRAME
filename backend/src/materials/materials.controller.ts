import {
  Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, UseGuards, ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateFixDto } from './dto/create-fix.dto';
import { UpdateSpecQtyDto } from './dto/update-spec-qty.dto';

@Controller('materials')
@UseGuards(JwtAuthGuard)
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get('project/:projectId')
  findAllByProject(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.materialsService.findAllByProject(projectId);
  }

  @Get(':id/fixes')
  findFixes(@Param('id', ParseIntPipe) id: number) {
    return this.materialsService.findFixes(id);
  }

  @Post()
  create(@Body(new ValidationPipe({ whitelist: true })) dto: CreateMaterialDto) {
    return this.materialsService.create(dto);
  }

  @Post(':id/fix')
  addFix(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateFixDto,
  ) {
    return this.materialsService.addFix(id, dto);
  }

  @Patch(':id/spec')
  updateSpecQty(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateSpecQtyDto,
  ) {
    return this.materialsService.updateSpecQty(id, dto.specQuantity);
  }

  @Patch(':id/lock')
  toggleLock(@Param('id', ParseIntPipe) id: number) {
    return this.materialsService.toggleSpecLock(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.materialsService.remove(id);
  }
}