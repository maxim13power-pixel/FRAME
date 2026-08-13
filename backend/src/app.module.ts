import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ObjectsModule } from './objects/objects.module';
import { ProjectsModule } from './projects/projects.module';
import { MaterialsModule } from './materials/materials.module';
import { PriceListModule } from './price-list/price-list.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // явно укажем путь
    }),
    AuthModule,
    ObjectsModule,
    ProjectsModule,
    MaterialsModule,
    PriceListModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
}