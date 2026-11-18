// backend/src/materials/materials.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ObjectAccessGuard } from '../auth/object-access.guard';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateFixDto } from './dto/create-fix.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpdateSpecQtyDto } from './dto/update-spec-qty.dto';
import { BulkIdsDto } from './dto/bulk-ids.dto'; // ⭐ №292: массовые операции
import { SyncCatalogPriceDto } from './dto/sync-catalog-price.dto'; // ⭐ №302
//import { CreatePriceItemDto } from '../price-list/dto/create-price-item.dto';
import { CreatePriceItemWithCategoryDto } from './dto/create-price-item-with-category.dto';
@Controller('materials')
@UseGuards(JwtAuthGuard, ObjectAccessGuard)
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get('project/:projectId')
  findAllByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req,
  ) {
    return this.materialsService.findAllByProject(projectId, req.user.userId);
  }

  @Get(':id/fixes')
  findFixes(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.materialsService.findFixes(id, req.user.userId);
  }

  @Post()
  create(
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateMaterialDto,
    @Req() req,
  ) {
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

  /**
   * ⭐ №302: «Изменить цену и в справочнике» для строки без привязки к расценке.
   * Работа и материал обрабатываются одинаково: позиция ищется по названию или создаётся.
   */
  @Post(':id/sync-price')
  syncPrice(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: SyncCatalogPriceDto,
    @Req() req,
  ) {
    return this.materialsService.syncPriceToCatalog(
      id,
      dto.side,
      dto.price,
      req.user.userId,
    );
  }

  /**
   * ⭐ №292: массовое дублирование строк сметы (кнопки при выделении чекбоксами).
   * ВАЖНО: объявлено ДО `@Post(':id/duplicate')`, иначе «bulk» уйдёт в ParseIntPipe.
   */
  @Post('bulk/duplicate')
  bulkDuplicate(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: BulkIdsDto,
    @Req() req,
  ) {
    return this.materialsService.bulkDuplicate(dto.ids, req.user.userId);
  }

  /** ⭐ №292: массовое удаление строк сметы. */
  @Post('bulk/delete')
  bulkRemove(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: BulkIdsDto,
    @Req() req,
  ) {
    return this.materialsService.bulkRemove(dto.ids, req.user.userId);
  }

  // ⭐ №162: копировать строку материала (план без факта и фиксаций)
  @Post(':id/duplicate')
  duplicate(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.materialsService.duplicate(id, req.user.userId);
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

  //@Post('price-item')
  //createPriceItem(
    //@Body(new ValidationPipe({ whitelist: true }))
    //body: {
      //item: CreatePriceItemDto;
      //newCategoryName?: string;
      //kind?: 'WORK' | 'MATERIAL';
    //},
    //@Req() req,
  //) {
    //return this.materialsService.createPriceItemWithCategory(
      //body.item,
      //body.newCategoryName,
      //body.kind,
      //req.user.userId,
    //);
  //}
@Post('price-item')
createPriceItem(
@Body(new ValidationPipe({ whitelist: true, transform: true }))
body: CreatePriceItemWithCategoryDto,
@Req() req,
) {
return this.materialsService.createPriceItemWithCategory(
body.item,
body.newCategoryName,
body.kind,
req.user.userId,
body.catalogId, // ⭐ №159: справочник проекта (из сметы)
);
}

  @Patch(':id/spec')
  updateSpecQty(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateSpecQtyDto,
    @Req() req,
  ) {
    return this.materialsService.updateSpecQty(
      id,
      dto.specQuantity,
      req.user.userId,
    );
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
