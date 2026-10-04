// backend/src/estimate-templates/estimate-templates.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EstimateTemplatesService } from './estimate-templates.service';
import { CreateEstimateTemplateDto } from './dto/create-estimate-template.dto';
import { ApplyEstimateTemplateDto } from './dto/apply-estimate-template.dto';

@Controller('estimate-templates')
@UseGuards(JwtAuthGuard)
export class EstimateTemplatesController {
  constructor(private readonly templatesService: EstimateTemplatesService) {}

  @Get()
  list(@Req() req) {
    return this.templatesService.list(req.user.userId);
  }

  @Post()
  create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: CreateEstimateTemplateDto,
    @Req() req,
  ) {
    return this.templatesService.create(dto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.templatesService.remove(id, req.user.userId);
  }

  @Post(':id/apply')
  apply(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: ApplyEstimateTemplateDto,
    @Req() req,
  ) {
    return this.templatesService.apply(id, dto, req.user.userId);
  }
}
