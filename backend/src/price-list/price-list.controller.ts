import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards, ValidationPipe, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgAccessGuard } from '../auth/org-access.guard';
import { PriceListService } from './price-list.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreatePriceItemDto } from './dto/create-price-item.dto';

@Controller('price-list')
@UseGuards(JwtAuthGuard, OrgAccessGuard)
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  @Get('categories')
  getCategories(@Query('kind') kind: string | undefined, @Req() req) {
    return this.priceListService.getCategories(kind, req.user.orgId);
  }

  @Get('categories/full')
  getCategoriesWithItems(@Query('kind') kind: string | undefined, @Req() req) {
    return this.priceListService.getCategoriesWithItems(kind, req.user.orgId);
  }

  @Get('items/search')
  searchItems(
    @Query('search') search: string | undefined,
    @Query('categoryId') categoryId: string | undefined,
    @Query('kind') kind: string | undefined,
    @Req() req,
  ) {
    return this.priceListService.searchItems(
      search,
      categoryId ? parseInt(categoryId) : undefined,
      kind,
      req.user.orgId,
    );
  }

  @Post('categories')
  createCategory(@Body(new ValidationPipe({ whitelist: true })) dto: CreateCategoryDto, @Req() req) {
    return this.priceListService.createCategory(dto, req.user.orgId);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateCategoryDto,
    @Req() req,
  ) {
    return this.priceListService.updateCategory(id, dto, req.user.orgId);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.priceListService.removeCategory(id, req.user.orgId);
  }

  @Post('items')
  createItem(@Body(new ValidationPipe({ whitelist: true })) dto: CreatePriceItemDto, @Req() req) {
    return this.priceListService.createItem(dto, req.user.orgId);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: Partial<CreatePriceItemDto>,
    @Req() req,
  ) {
    return this.priceListService.updateItem(id, dto, req.user.orgId);
  }

  @Delete('items/:id')
  removeItem(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.priceListService.removeItem(id, req.user.orgId);
  }
}