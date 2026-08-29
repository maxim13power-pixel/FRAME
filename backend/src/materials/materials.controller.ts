import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgAccessGuard } from '../auth/org-access.guard';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateFixDto } from './dto/create-fix.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateSpecQtyDto } from './dto/update-spec-qty.dto';
import { CreatePriceItemDto } from '../price-list/dto/create-price-item.dto';

@Controller('materials')
@UseGuards(JwtAuthGuard, OrgAccessGuard)
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get('project/:projectId')
  findAllByProject(@Param('projectId', ParseIntPipe) projectId: number, @Req() req) {
    return this.materialsService.findAllByProject(projectId, req.user.orgId);
  }

  @Get(':id/fixes')
  findFixes(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.materialsService.findFixes(id, req.user.orgId);
  }

  @Post()
  create(@Body(new ValidationPipe({ whitelist: true })) dto: CreateMaterialDto, @Req() req) {
    return this.materialsService.create(dto, req.user.orgId);
  }

  @Post(':id/fix')
  addFix(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateFixDto,
    @Req() req,
  ) {
    return this.materialsService.addFix(id, dto, req.user.userId, req.user.orgId);
  }

  @Patch(':id/last-fix')
  editLastFix(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateFixDto,
    @Req() req,
  ) {
    return this.materialsService.editLastFix(id, dto, req.user.userId, req.user.orgId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateMaterialDto,
    @Req() req,
  ) {
    return this.materialsService.update(id, dto, req.user.orgId);
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
      req.user.orgId,
    );
  }

  @Patch(':id/spec')
  updateSpecQty(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateSpecQtyDto,
    @Req() req,
  ) {
    return this.materialsService.updateSpecQty(id, dto.specQuantity, req.user.orgId);
  }

  @Patch(':id/lock')
  toggleLock(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.materialsService.toggleSpecLock(id, req.user.orgId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.materialsService.remove(id, req.user.orgId);
  }
}