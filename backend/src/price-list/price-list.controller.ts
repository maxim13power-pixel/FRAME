import {
  Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, Query, UseGuards, ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PriceListService } from './price-list.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreatePriceItemDto } from './dto/create-price-item.dto';

@Controller('price-list')
@UseGuards(JwtAuthGuard)
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  @Get('categories')
  getCategories(@Query('kind') kind?: string) {
    return this.priceListService.getCategories(kind);
  }
  @Get('categories/full')
  getCategoriesWithItems(@Query('kind') kind?: string) {
    return this.priceListService.getCategoriesWithItems(kind);
  }
  @Get('items/search')
  searchItems(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('kind') kind?: string,
  ) {
    return this.priceListService.searchItems(
      search,
      categoryId ? parseInt(categoryId) : undefined,
      kind,
    );
  }

  @Post('categories')
  createCategory(@Body(new ValidationPipe({ whitelist: true })) dto: CreateCategoryDto) {
    return this.priceListService.createCategory(dto);
  }

    @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdateCategoryDto,
  ) {
    return this.priceListService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.priceListService.removeCategory(id);
  }

  @Post('items')
  createItem(@Body(new ValidationPipe({ whitelist: true })) dto: CreatePriceItemDto) {
    return this.priceListService.createItem(dto);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true })) dto: Partial<CreatePriceItemDto>,
  ) {
    return this.priceListService.updateItem(id, dto);
  }

  @Delete('items/:id')
  removeItem(@Param('id', ParseIntPipe) id: number) {
    return this.priceListService.removeItem(id);
  }
}