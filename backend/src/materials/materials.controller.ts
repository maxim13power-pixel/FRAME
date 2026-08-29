// backend/src/materials/materials.controller.ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateFixDto } from './dto/create-fix.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateSpecQtyDto } from './dto/update-spec-qty.dto';
import { CreatePriceItemDto } from '../price-list/dto/create-price-item.dto';

@Controller('materials')
@UseGuards(JwtAuthGuard)
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get('project/:projectId')
  findAllByProject(@Param('projectId', ParseIntPipe) projectId: number, @Req() req) {
    return this.materialsService.findAllByProject(projectId, req.user.userId);
  }

  @Get(':id/fixes')
  findFixes(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.materialsService.findFixes(id, req.user.userId);
  }

  @Post()
  create(@Body(new ValidationPipe({ whitelist: true })) dto: CreateMaterialDto, @Req() req) {
    return this.materialsService.create(dto, req.user.userId);
  }

  @Post(':id/fix')
  addFix(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateFixDto,
    @Req() req,
  ) {
    return this.materialsService.addFix(id, dto, req.user.userId);
  }

  @Patch(':id/last-fix')
  editLastFix(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateFixDto,
    @Req() req,
  ) {
    return this.materialsService.editLastFix(id, dto, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateMaterialDto,
    @Req() req,
  ) {
    return this.materialsService.update(id, dto, req.user.userId);
  }

  @Post('price-item')
  createPriceItem(
    @Body(new ValidationPipe({ whitelist: true })) body: {
      item: CreatePriceItemDto;
      newCategoryName?: string;
      kind?: 'WORK' | 'MATERIAL';
    },
    @Req() req,
  ) {
    return this.materialsService.createPriceItemWithCategory(
      body.item,
      body.newCategoryName,
      body.kind,
      req.user.userId,
    );
  }

  @Patch(':id/spec')
  updateSpecQty(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateSpecQtyDto,
    @Req() req,
  ) {
    return this.materialsService.updateSpecQty(id, dto.specQuantity, req.user.userId);
  }

  @Patch(':id/lock')
  toggleLock(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.materialsService.toggleSpecLock(id, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.materialsService.remove(id, req.user.userId);
  }
}