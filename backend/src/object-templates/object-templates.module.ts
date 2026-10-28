// backend/src/object-templates/object-templates.module.ts
// ⭐ №175: шаблоны объектов
import { Module } from '@nestjs/common';
import { ObjectTemplatesController } from './object-templates.controller';
import { ObjectTemplatesService } from './object-templates.service';
import { ObjectsModule } from '../objects/objects.module';

@Module({
  imports: [ObjectsModule],
  controllers: [ObjectTemplatesController],
  providers: [ObjectTemplatesService],
  exports: [ObjectTemplatesService],
})
export class ObjectTemplatesModule {}
