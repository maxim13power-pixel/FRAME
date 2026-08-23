import {
  Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, Req, UseGuards, ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateFixDto } from './dto/create-fix.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateSpecQtyDto } from './dto/update-spec-qty.dto';
import { CreatePriceItemDto } from '../price-list/dto/create-price-item.dto';

// Тип запроса после JwtAuthGuard: validate() jwt.strategy возвращает { userId, phone, role }
type AuthedRequest = { user?: { userId?: number | null; phone?: string; role?: string } };

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
    @Req() req: AuthedRequest,
  ) {
    return this.materialsService.addFix(id, dto, req.user?.userId ?? null);
  }


  @Patch(':id/last-fix')
  editLastFix(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateFixDto,
    @Req() req: AuthedRequest,
  ) {
    return this.materialsService.editLastFix(id, dto, req.user?.userId ?? null);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateMaterialDto,
  ) {
    return this.materialsService.update(id, dto);
  }

  // ✨ Создать расценку (+ опционально новую категорию) и вернуть её фронтенду
  // ⭐ kind приходит с фронта ('WORK'/'MATERIAL') — раньше терялся по дороге,
  // и расценки материалов создавались как работы (баг 23/08)
  @Post('price-item')
  createPriceItem(
    @Body(new ValidationPipe({ whitelist: true })) body: {
      item: CreatePriceItemDto;
      newCategoryName?: string;
      kind?: 'WORK' | 'MATERIAL';
    },
  ) {
    return this.materialsService.createPriceItemWithCategory(
      body.item,
      body.newCategoryName,
      body.kind,
    );
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
